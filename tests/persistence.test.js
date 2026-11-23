import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase, initialize } from '../backend/db.js';

test('El primer arranque crea la carpeta local y el reinicio conserva el estado de la base', async () => {
  const workingDir = await mkdtemp(join(tmpdir(), 'stt-persistencia-'));
  const dataDir = join(workingDir, 'data', 'stt');
  let db;
  try {
    db = await openDatabase({ dataDir });
    const settings = {
      adminPassword: randomBytes(20).toString('hex'),
      techPassword: randomBytes(20).toString('hex'),
    };
    await initialize(db, settings);
    await db.query('DELETE FROM solicitudes WHERE cliente = $1', ['CLI-001']);
    await db.close();
    db = null;

    db = await openDatabase({ dataDir });
    await initialize(db, settings);
    const { rows } = await db.query('SELECT cliente FROM solicitudes ORDER BY id');
    assert.equal(rows.length, 5);
    assert.ok(rows.every(row => row.cliente !== 'CLI-001'));
  } finally {
    if (db) await db.close();
    await rm(workingDir, { recursive: true, force: true });
  }
});
