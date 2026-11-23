import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Edit3, Save, Trash2 } from "lucide-react";
import { api, categorias, ErrorApi, estados, fecha, prioridades, useRecurso, type Formulario, type Solicitud, type Usuario } from "./datos";
import { AvisoError, Cabecera, Cargando, IconoCategoria, Insignia, Regresar } from "./ui";

const inicial: Formulario = { cliente: "", titulo: "", descripcion: "", categoria: "Soporte", prioridad: "Media", estado: "Pendiente" };
function useListaAnterior() {
  const { state } = useLocation();
  return typeof state?.lista === "string" && /^\/solicitudes(?:\?|$)/.test(state.lista) ? state.lista : "/solicitudes";
}
function FormularioCaso({ original, lista }: { original?: Solicitud; lista: string }) {
  const navegar = useNavigate();
  const [form, poner] = useState<Formulario>(original || inicial);
  const [guardando, guardar] = useState(false);
  const [error, informar] = useState<Error>();
  const campo = (nombre: keyof Formulario, valor: string) => poner(previo => ({ ...previo, [nombre]: valor }));
  const esEdicion = Boolean(original);
  const detalle = original ? "/solicitudes/" + original.id : lista;
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    guardar(true); informar(undefined);
    try {
      const campos = { cliente: form.cliente.trim().toUpperCase(), titulo: form.titulo.trim(), descripcion: form.descripcion.trim(),
        categoria: form.categoria, prioridad: form.prioridad, estado: form.estado };
      const res = await api<{ solicitud: Solicitud }>(original ? "/solicitudes/" + original.id : "/solicitudes", {
        method: original ? "PUT" : "POST", body: JSON.stringify({ ...campos, ...(original && { version: original.version }) })
      });
      navegar("/solicitudes/" + res.solicitud.id, { replace: true, state: { lista, aviso: original ? "Cambios guardados." : "Solicitud registrada correctamente." } });
    } catch (err) { informar(err as Error); } finally { guardar(false); }
  }
  return <><Regresar to={detalle} texto={original?.folio || "Solicitudes"}/>
    <Cabecera titulo={esEdicion ? "Editar solicitud" : "Nueva solicitud"} texto={original ? `${original.folio} · Versión ${original.version}` : "Registra los datos del cliente y el servicio que requiere."}/>
    <form className="panel formulario" onSubmit={enviar}>
      <div className="campos"><label>Código de cliente<input autoFocus value={form.cliente} onChange={e => campo("cliente", e.target.value)} required pattern="[Cc][Ll][Ii]-[0-9]{3,8}" title="CLI seguido de un guion y entre 3 y 8 dígitos" maxLength={12} placeholder="CLI-001"/></label>
        <label>Título<input value={form.titulo} onChange={e => campo("titulo", e.target.value)} required minLength={3} maxLength={120} placeholder="Ej. Interrupción de la red de oficina"/></label>
        <label className="ancho">Descripción<textarea rows={4} value={form.descripcion} onChange={e => campo("descripcion", e.target.value)} required minLength={10} maxLength={1000} placeholder="Describe el problema y el servicio solicitado."/></label>
      </div><div className="campos tres">{([{ nombre: "Categoría", key: "categoria", opciones: categorias }, { nombre: "Prioridad", key: "prioridad", opciones: prioridades }, { nombre: "Estado", key: "estado", opciones: estados }] as const)
        .map(({ nombre, key, opciones }) => <label key={key}>{nombre}<select value={form[key]} onChange={e => campo(key, e.target.value)}>{opciones.map(valor => <option key={valor}>{valor}</option>)}</select></label>)}</div>
      {error && <AvisoError error={error}/>}
      {error instanceof ErrorApi && error.status === 409 && <p className="nota-conflicto"><Link to={detalle} state={{ lista }}>Ver la versión actual</Link> para revisar los cambios antes de editar de nuevo.</p>}
      <div className="acciones-form"><Link className="boton secundario" to={detalle} state={{ lista }}>Cancelar</Link>
        <button disabled={guardando} className="boton primario" type="submit"><Save size={16}/>{guardando ? "Guardando…" : original ? "Guardar cambios" : "Registrar solicitud"}</button></div>
    </form></>;
}
function Detalle({ item, usuario, lista, recargar }: { item: Solicitud; usuario: Usuario; lista: string; recargar: () => void }) {
  const navegar = useNavigate();
  const confirmacion = useRef<HTMLDialogElement>(null);
  const [eliminando, cambiarOcupado] = useState(false);
  const [error, informar] = useState<Error>();
  async function quitar() {
    if (eliminando) return;
    cambiarOcupado(true); informar(undefined);
    try {
      await api("/solicitudes/" + item.id, { method: "DELETE", body: JSON.stringify({ version: item.version }) });
      navegar(lista, { replace: true, state: { aviso: "Solicitud eliminada. El movimiento quedó registrado." } });
    } catch (e) { confirmarCierre(); informar(e as Error); } finally { cambiarOcupado(false); }
  }
  const confirmarCierre = () => confirmacion.current?.close();
  return <><Regresar to={lista}/><div className="folio"><IconoCategoria categoria={item.categoria}/>{item.folio}</div>
    <Cabecera titulo={item.titulo} texto={item.categoria} accion={<Link className="boton primario" to="editar" state={{ lista }}><Edit3 size={17}/>Editar solicitud</Link>} />
    <section className="panel detalle"><div className="panel-titulo"><h2>Detalle de la solicitud</h2><Insignia valor={item.estado}/></div>
      <div className="detalle-cuerpo"><h3>Descripción</h3><p>{item.descripcion}</p><dl>
        <div><dt>Cliente</dt><dd>{item.cliente}</dd></div><div><dt>Prioridad</dt><dd><Insignia valor={item.prioridad}/></dd></div>
        <div><dt>Registro</dt><dd>{fecha(item.creado, true)}</dd></div><div><dt>Última actualización</dt><dd>{fecha(item.actualizado, true)}</dd></div>
        <div><dt>Versión</dt><dd>{item.version}</dd></div>
      </dl>
      {error && <AvisoError error={error} reintentar={recargar}/>}
      {usuario.rol === "administrador" && <button type="button" className="boton eliminar-enlace" onClick={() => confirmacion.current?.showModal()}><Trash2 size={16}/>Eliminar solicitud</button>}</div>
    </section>
    <dialog ref={confirmacion} className="dialogo" aria-labelledby="confirmar-titulo" onCancel={e => { if (eliminando) e.preventDefault(); }}>
      <h2 id="confirmar-titulo">Eliminar solicitud</h2><p>Se eliminará <strong>{item.folio}</strong>. La eliminación quedará registrada en la actividad del equipo.</p>
      <div className="acciones-form"><button className="boton secundario" disabled={eliminando} onClick={confirmarCierre} autoFocus>Cancelar</button>
        <button disabled={eliminando} className="boton peligro" onClick={quitar}>{eliminando ? "Eliminando…" : "Sí, eliminar solicitud"}</button></div>
    </dialog></>;
}

export default function Caso({ modo, usuario }: { modo: "nuevo" | "editar" | "detalle"; usuario: Usuario }) {
  const { id } = useParams();
  const lista = useListaAnterior();
  const existeFormato = Boolean(id && /^[1-9]\d*$/.test(id));
  const resultado = useRecurso<{ solicitud: Solicitud }>(modo !== "nuevo" && existeFormato ? "/solicitudes/" + id : null);
  useEffect(() => { window.scrollTo(0, 0); }, [id, modo]);
  if (modo === "nuevo") return <FormularioCaso key="nuevo" lista={lista}/>;
  if (!existeFormato || resultado.error) return <><Regresar to={lista}/><Cabecera titulo="Detalle de solicitud"/><AvisoError error={resultado.error || "El folio solicitado no es válido."} reintentar={resultado.error ? resultado.recargar : undefined}/></>;
  if (!resultado.datos) return <Cargando texto="Consultando el caso…"/>;
  const item = resultado.datos.solicitud;
  return modo === "editar" ? <FormularioCaso key={item.id + "-" + item.version} original={item} lista={lista}/> : <Detalle item={item} usuario={usuario} lista={lista} recargar={resultado.recargar}/>;
}
