import { ApiError } from "./http";
const enc = new TextEncoder(), ISSUER = "stt-soporte", AUDIENCE = "stt-web";
export const SESSION_SECONDS = 3600;
function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}
function encoded(value: unknown) { return base64url(enc.encode(JSON.stringify(value))); }
async function key(secret: string) {
  if (!secret || secret.length < 32) throw new ApiError(503, "Falta configurar la clave del servidor.");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export interface Claims { sub: string; jti: string; exp: number; iat: number; iss: string; aud: string; }
export async function signJwt(sub: string, jti: string, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: Claims = { sub, jti, exp: now + SESSION_SECONDS, iat: now, iss: ISSUER, aud: AUDIENCE };
  const data = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded(payload)}`;
  return `${data}.${base64url(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(data))))}`;
}
export async function verifyJwt(token: string, secret: string): Promise<Claims> {
  const hmacKey = await key(secret);
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error();
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (header.alg !== "HS256" || header.typ !== "JWT") throw new Error();
    if (!await crypto.subtle.verify("HMAC", hmacKey, decode(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`))) throw new Error();
    const c = JSON.parse(new TextDecoder().decode(decode(parts[1]))), now = Math.floor(Date.now() / 1000);
    if (c.iss !== ISSUER || c.aud !== AUDIENCE || !Number.isInteger(c.exp) || c.exp <= now || !Number.isInteger(c.iat)
      || c.iat > now + 30 || c.exp - c.iat !== SESSION_SECONDS || typeof c.sub !== "string" || typeof c.jti !== "string") throw new Error();
    return c;
  } catch { throw new ApiError(401, "Tu sesión no es válida o ha vencido. Inicia sesión de nuevo."); }
}
export async function hashPassword(password: string, suppliedSalt?: string) {
  const salt = suppliedSalt ?? base64url(crypto.getRandomValues(new Uint8Array(16)));
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, material, 256);
  return `pbkdf2$100000$${salt}$${base64url(new Uint8Array(hash))}`;
}
export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2" || parts[1] !== "100000") return false;
  const a = enc.encode(await hashPassword(password, parts[2])), b = enc.encode(stored);
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export function sessionCookie(request: Request, token: string, maxAge = SESSION_SECONDS) {
  return `stt_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function readToken(request: Request) {
  return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith("stt_session="))?.slice(12);
}
