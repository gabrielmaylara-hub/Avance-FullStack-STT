import { mkdir, readFile } from 'node:fs/promises';
import { hashPassword } from './auth.js';

export async function openDatabase({ connectionString, dataDir } = {}) {
  if (!connectionString) {
    const { PGlite } = await import('@electric-sql/pglite');
    if (dataDir && !dataDir.includes('://')) await mkdir(dataDir, { recursive: true });
    const db = new PGlite(dataDir);
    return {
      query: (sql, values) => db.query(sql, values),
      transaction: fn => db.transaction(fn),
      close: () => db.close(),
    };
  }
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 8, connectionTimeoutMillis: 10000 });
  pool.on('error', err => console.error('Conexión inactiva de PostgreSQL interrumpida:', err.code ?? 'desconocido'));
  return {
    query: (sql, values) => pool.query(sql, values),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (sql, values) => client.query(sql, values), exec: sql => client.query(sql) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

const accounts = [
  ['demo-admin', 'admin@stt.test', 'Administración STT', 'administrador', 'adminPassword'],
  ['demo-tecnico', 'tecnico@stt.test', 'Técnico de soporte', 'tecnico', 'techPassword'],
];

export async function initialize(db, options = {}) {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await db.transaction(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(7229881)');
    await tx.exec(schema);
    for (const [id, email, name, role, setting] of accounts) {
      if ((await tx.query('SELECT id FROM usuarios WHERE id = $1', [id])).rows.length) continue;
      const password = options[setting];
      if (typeof password !== 'string' || password.length < 12 || password.length > 200) {
        throw new Error(`Configura una contraseña inicial de 12 a 200 caracteres para ${email}.`);
      }
      await tx.query(
        'INSERT INTO usuarios (id,usuario,nombre,rol,password_hash) VALUES ($1,$2,$3,$4,$5)',
        [id, email, name, role, await hashPassword(password)],
      );
    }
    if (options.seedDemo !== false) {
      const marker = await tx.query("INSERT INTO inicializacion (nombre) VALUES ('solicitudes-demo-v1') ON CONFLICT DO NOTHING RETURNING nombre");
      if (marker.rows.length) await tx.exec(await readFile(new URL('./demo.sql', import.meta.url), 'utf8'));
    }
  });
}
