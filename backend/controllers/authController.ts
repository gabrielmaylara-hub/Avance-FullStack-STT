import { ApiError, body, json } from "../lib/http";
import { hashPassword, verifyPassword, signJwt, sessionCookie, SESSION_SECONDS } from "../lib/security";
import type { AppEnv } from "../middleware/auth";
import type { Usuario } from "../models/solicitud";
// Cuentas iniciales con una contraseña configurada en el servidor.
async function ensureDemoUsers(env: AppEnv) {
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM usuarios").first<{ n: number }>();
  if (count?.n) return;
  if (!env.DEMO_PASSWORD || env.DEMO_PASSWORD.length < 12) throw new ApiError(503, "No fue posible preparar las cuentas de acceso. Contacta al administrador.");
  const now = new Date().toISOString(), adminHash = await hashPassword(env.DEMO_PASSWORD), techHash = await hashPassword(env.DEMO_PASSWORD);
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO usuarios (id,usuario,nombre,rol,password_hash,creado) VALUES (?,?,?,?,?,?)")
      .bind("demo-admin","admin@stt.test","Administración STT","administrador",adminHash,now),
    env.DB.prepare("INSERT OR IGNORE INTO usuarios (id,usuario,nombre,rol,password_hash,creado) VALUES (?,?,?,?,?,?)")
      .bind("demo-tecnico","tecnico@stt.test","Técnico de soporte","tecnico",techHash,now),
  ]);
}
export async function login(request: Request, env: AppEnv) {
  const data = await body(request);
  const usuario = typeof data.usuario === "string" ? data.usuario.trim().toLowerCase() : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (!usuario || usuario.length>100 || !password || password.length>200) throw new ApiError(400,"Escribe usuario y contraseña válidos.");
  await ensureDemoUsers(env);
  const now = Math.floor(Date.now()/1000), key = `${request.headers.get("cf-connecting-ip") ?? "local"}:${usuario}`;
  const attempt = await env.DB.prepare("SELECT fallos,hasta FROM intentos_login WHERE clave=?").bind(key).first<{ fallos: number; hasta: number }>();
  if (attempt && attempt.fallos>=5 && attempt.hasta>now) throw new ApiError(429,"Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.");
  const user = await env.DB.prepare("SELECT id,usuario,nombre,rol,password_hash FROM usuarios WHERE usuario=?").bind(usuario).first<Usuario & { password_hash: string }>();
  const hash = user?.password_hash ?? await hashPassword("usuario-inexistente");
  if (!await verifyPassword(password,hash) || !user) {
    const failures = attempt && attempt.hasta>now ? attempt.fallos+1 : 1;
    await env.DB.prepare("INSERT INTO intentos_login (clave,fallos,hasta) VALUES (?,?,?) ON CONFLICT(clave) DO UPDATE SET fallos=excluded.fallos,hasta=excluded.hasta").bind(key,failures,now+900).run();
    throw new ApiError(401,"Usuario o contraseña incorrectos.");
  }
  const jti=crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM intentos_login WHERE clave=?").bind(key),
    env.DB.prepare("DELETE FROM sesiones WHERE expira<=?").bind(now),
    env.DB.prepare("INSERT INTO sesiones (id,usuario_id,expira) VALUES (?,?,?)").bind(jti,user.id,now+SESSION_SECONDS),
  ]);
  const token=await signJwt(user.id,jti,env.JWT_SECRET), { password_hash: _hash, ...publicUser }=user;
  return json({ usuario:publicUser },200,{ "Set-Cookie":sessionCookie(request,token) });
}
export async function logout(request: Request,env: AppEnv,sessionId: string) {
  await env.DB.prepare("DELETE FROM sesiones WHERE id=?").bind(sessionId).run();
  return json({ mensaje:"Sesión cerrada." },200,{ "Set-Cookie":sessionCookie(request,"",0) });
}
