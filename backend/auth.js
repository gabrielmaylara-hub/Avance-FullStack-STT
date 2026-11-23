import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import { HttpError } from './errors.js';

const KDF = promisify(scrypt);
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const ISSUER = 'stt-soporte';
const AUDIENCE = 'stt-web';
const SESSION_SECONDS = 3600;
const COOKIE = 'stt_session';
// Aplica el mismo costo de derivación a los usuarios inexistentes.
const DUMMY_HASH = `scrypt-v1$${randomBytes(16).toString('hex')}$${randomBytes(32).toString('hex')}`;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await KDF(password, salt, 32, SCRYPT);
  return `scrypt-v1$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, salt, digest] = encoded.split('$');
  if (algorithm !== 'scrypt-v1' || !/^[\da-f]{32}$/.test(salt) || !/^[\da-f]{64}$/.test(digest)) return false;
  const derived = await KDF(password, Buffer.from(salt, 'hex'), 32, SCRYPT);
  return timingSafeEqual(derived, Buffer.from(digest, 'hex'));
}

function getClaims(req, secret) {
  const cookie = (req.headers.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  if (!cookie) throw new HttpError(401, 'Inicia sesión para continuar.');
  try {
    const claims = jwt.verify(cookie.slice(COOKIE.length + 1), secret, {
      algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE,
    });
    if (typeof claims.sub !== 'string' || typeof claims.jti !== 'string' || !Number.isInteger(claims.exp)) {
      throw new Error('claims');
    }
    return claims;
  } catch {
    throw new HttpError(401, 'La sesión venció o no es válida. Inicia sesión de nuevo.');
  }
}

export function authHandlers(db, secret, production) {
  const options = { httpOnly: true, sameSite: 'strict', secure: production, path: '/' };
  return {
    async login(req, res) {
      const { usuario, password } = req.input;
      const key = createHash('sha256').update(`${req.ip}|${usuario}`).digest('hex');
      const result = await db.transaction(async tx => {
        // Serializa únicamente los intentos simultáneos del mismo usuario y origen.
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
        const { rows: attempts } = await tx.query(
          'SELECT fallos FROM intentos_login WHERE clave = $1 AND hasta > now()', [key],
        );
        if (attempts[0]?.fallos >= 5) return { blocked: true };
        const { rows } = await tx.query('SELECT id, usuario, nombre, rol, password_hash FROM usuarios WHERE usuario = $1', [usuario]);
        const user = rows[0];
        const matches = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
        await tx.query('DELETE FROM intentos_login WHERE hasta <= now()');
        if (!matches || !user) {
          await tx.query(
            `INSERT INTO intentos_login (clave, fallos, hasta) VALUES ($1, 1, now() + interval '15 minutes')
             ON CONFLICT (clave) DO UPDATE SET fallos = intentos_login.fallos + 1, hasta = EXCLUDED.hasta`, [key],
          );
          return { invalid: true };
        }
        const sessionId = randomUUID();
        const token = jwt.sign({ rol: user.rol }, secret, {
          algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE,
          subject: user.id, jwtid: sessionId, expiresIn: SESSION_SECONDS,
        });
        await tx.query('DELETE FROM intentos_login WHERE clave = $1', [key]);
        await tx.query('DELETE FROM sesiones WHERE expira <= now()');
        await tx.query("INSERT INTO sesiones (id, usuario_id, expira) VALUES ($1,$2,now() + interval '1 hour')", [sessionId, user.id]);
        return { token, usuario: { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol } };
      });
      if (result.blocked) throw new HttpError(429, 'Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.');
      if (result.invalid) throw new HttpError(401, 'Usuario o contraseña incorrectos.');
      res.cookie(COOKIE, result.token, { ...options, maxAge: SESSION_SECONDS * 1000 }).json({ usuario: result.usuario });
    },

    async authenticate(req, _res, next) {
      const claims = getClaims(req, secret);
      const { rows } = await db.query(
        `SELECT u.id, u.usuario, u.nombre, u.rol FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
         WHERE s.id = $1 AND u.id = $2 AND u.rol = $3 AND s.expira > now()`,
        [claims.jti, claims.sub, claims.rol],
      );
      if (!rows.length) throw new HttpError(401, 'La sesión terminó. Vuelve a iniciar sesión.');
      req.user = rows[0];
      req.sessionId = claims.jti;
      next();
    },

    async logout(req, res) {
      await db.query('DELETE FROM sesiones WHERE id = $1', [req.sessionId]);
      res.clearCookie(COOKIE, options).json({ mensaje: 'Sesión cerrada.' });
    },
  };
}

export function requireAdmin(req, _res, next) {
  if (req.user?.rol !== 'administrador') throw new HttpError(403, 'Esta acción requiere una cuenta administradora.');
  next();
}
