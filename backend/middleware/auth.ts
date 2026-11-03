import { ApiError } from "../lib/http";
import { readToken, verifyJwt } from "../lib/security";
import type { Usuario } from "../models/solicitud";
export interface AppEnv { DB: D1Database; JWT_SECRET: string; DEMO_PASSWORD: string; }
export async function authenticate(request: Request, env: AppEnv) {
  const token = readToken(request);
  if (!token) throw new ApiError(401, "Inicia sesión para continuar.");
  const claims = await verifyJwt(token, env.JWT_SECRET);
  const user = await env.DB.prepare(`SELECT u.id,u.usuario,u.nombre,u.rol FROM usuarios u JOIN sesiones s ON s.usuario_id=u.id
    WHERE s.id=? AND u.id=? AND s.expira>?`).bind(claims.jti, claims.sub, Math.floor(Date.now()/1000)).first<Usuario>();
  if (!user) throw new ApiError(401, "La sesión terminó. Vuelve a iniciar sesión.");
  return { user, sessionId: claims.jti };
}
export function requireAdmin(user: Usuario) {
  if (user.rol !== "administrador") throw new ApiError(403, "Solo la cuenta administradora puede eliminar solicitudes.");
}
