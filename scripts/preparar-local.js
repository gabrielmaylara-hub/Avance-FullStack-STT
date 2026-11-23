import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { readFile } from 'node:fs/promises';

function localPassword() {
  return randomBytes(16).toString('base64url');
}

// El paquete del instructor incluye dos cuentas de muestra para esta instalación.
let demo = {};
try {
  const access = await readFile(new URL('../../Acceso.txt', import.meta.url), 'utf8');
  demo = parseEnv(access.split('[Cuentas locales]')[1] ?? '');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const lines = [
  'PORT=3000', 'PGLITE_DIR=./data/stt',
  'JWT_SECRET=' + randomBytes(48).toString('base64url'),
  'ADMIN_PASSWORD=' + (demo.ADMIN_PASSWORD || localPassword()),
  'TECH_PASSWORD=' + (demo.TECH_PASSWORD || localPassword()),
];
try {
  await writeFile(new URL('../.env', import.meta.url), lines.join('\n') + '\n', {flag:'wx',mode:0o600});
  console.log('Entorno local preparado. Las contraseñas para admin@stt.test y tecnico@stt.test están en .env.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Se conservó la configuración local existente en .env.');
}
