import { ApiError,body,folio,json } from "../lib/http";
import { validateSolicitud,type SolicitudRow,type Usuario } from "../models/solicitud";
import { requireAdmin,type AppEnv } from "../middleware/auth";
function presented(row: SolicitudRow) { return { ...row,folio:folio(row.id) }; }
export async function list(request: Request,env: AppEnv) {
  const p=new URL(request.url).searchParams, q=(p.get("q")??"").trim().slice(0,120), estado=p.get("estado")??"", categoria=p.get("categoria")??"";
  const pattern=`%${q.replace(/[\\%_]/g,"\\$&")}%`;
  const result=await env.DB.prepare(`SELECT * FROM solicitudes WHERE
    (?='' OR titulo LIKE ? ESCAPE '\\' OR cliente LIKE ? ESCAPE '\\' OR printf('STT-%04d',id) LIKE ? ESCAPE '\\')
    AND (?='' OR estado=?) AND (?='' OR categoria=?) ORDER BY id DESC LIMIT 500`)
    .bind(q,pattern,pattern,pattern,estado,estado,categoria,categoria).all<SolicitudRow>();
  return json({ solicitudes:result.results.map(presented) });
}
export async function detail(env: AppEnv,id: number) {
  const row=await env.DB.prepare("SELECT * FROM solicitudes WHERE id=?").bind(id).first<SolicitudRow>();
  if (!row) throw new ApiError(404,"No se encontró la solicitud.");
  return json({ solicitud:presented(row) });
}
export async function create(request: Request,env: AppEnv,user: Usuario) {
  const d=validateSolicitud(await body(request)), now=new Date().toISOString();
  const r=await env.DB.batch([
    env.DB.prepare(`INSERT INTO solicitudes (cliente,titulo,descripcion,categoria,prioridad,estado,creado,actualizado,creado_por,version)
      VALUES (?,?,?,?,?,?,?,?,?,1) RETURNING *`).bind(d.cliente,d.titulo,d.descripcion,d.categoria,d.prioridad,d.estado,now,now,user.id),
    env.DB.prepare("INSERT INTO actividad (solicitud_id,usuario_id,accion,detalle,fecha) VALUES (last_insert_rowid(),?,?,?,?)").bind(user.id,"Creación",d.titulo,now),
  ]);
  return json({ solicitud:presented(r[0].results[0] as unknown as SolicitudRow),mensaje:"Solicitud registrada." },201);
}
export async function update(request: Request,env: AppEnv,user: Usuario,id: number) {
  const raw=await body(request), d=validateSolicitud(raw), now=new Date().toISOString();
  if (!Number.isSafeInteger(raw.version)||(raw.version as number)<1) throw new ApiError(400,"Falta la versión del registro. Actualiza la lista.");
  const r=await env.DB.batch([
    env.DB.prepare(`UPDATE solicitudes SET cliente=?,titulo=?,descripcion=?,categoria=?,prioridad=?,estado=?,actualizado=?,version=version+1
      WHERE id=? AND version=? RETURNING *`).bind(d.cliente,d.titulo,d.descripcion,d.categoria,d.prioridad,d.estado,now,id,raw.version),
    env.DB.prepare("INSERT INTO actividad (solicitud_id,usuario_id,accion,detalle,fecha) SELECT ?,?,?,?,? WHERE changes()>0")
      .bind(id,user.id,"Actualización",`${d.titulo} · ${d.estado}`,now),
  ]);
  const row=r[0].results[0] as unknown as SolicitudRow|undefined;
  if (!row) {
    const exists=await env.DB.prepare("SELECT id FROM solicitudes WHERE id=?").bind(id).first();
    throw new ApiError(exists?409:404,exists?"Otra persona cambió esta solicitud. Actualiza la lista antes de editarla.":"No se encontró la solicitud.");
  }
  return json({ solicitud:presented(row),mensaje:"Cambios guardados." });
}
export async function remove(request: Request,env: AppEnv,user: Usuario,id: number) {
  requireAdmin(user);
  const raw=await body(request);
  if (!Number.isSafeInteger(raw.version)) throw new ApiError(400,"Falta la versión del registro.");
  const r=await env.DB.batch([
    env.DB.prepare("DELETE FROM solicitudes WHERE id=? AND version=? RETURNING *").bind(id,raw.version),
    env.DB.prepare("INSERT INTO actividad (solicitud_id,usuario_id,accion,detalle,fecha) SELECT ?,?,?,?,? WHERE changes()>0")
      .bind(id,user.id,"Eliminación",`Solicitud ${folio(id)} eliminada`,new Date().toISOString()),
  ]);
  if (!r[0].results.length) {
    const exists=await env.DB.prepare("SELECT id FROM solicitudes WHERE id=?").bind(id).first();
    throw new ApiError(exists?409:404,exists?"La solicitud cambió. Actualiza la lista antes de eliminarla.":"No se encontró la solicitud.");
  }
  return json({ mensaje:"Solicitud eliminada." });
}
export async function history(env: AppEnv) {
  const r=await env.DB.prepare("SELECT a.*,u.nombre FROM actividad a JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.id DESC LIMIT 50").all();
  return json({ actividad:r.results.map(row=>({...row,folio:folio(Number(row.solicitud_id))})) });
}
export async function summary(env: AppEnv) {
  const row=await env.DB.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN estado='Pendiente' THEN 1 ELSE 0 END) AS pendientes,
    SUM(CASE WHEN estado='En proceso' THEN 1 ELSE 0 END) AS proceso,
    SUM(CASE WHEN estado='Resuelta' THEN 1 ELSE 0 END) AS resueltas,
    SUM(CASE WHEN prioridad IN ('Alta','Crítica') AND estado!='Resuelta' THEN 1 ELSE 0 END) AS prioritarias FROM solicitudes`).first();
  return json({ resumen:row });
}
