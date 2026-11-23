import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDatabase, initialize } from './db.js';
import { createWeatherRouter } from './weather.js';

const production = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;
if (production && !connectionString && !process.env.PGLITE_DIR) {
  throw new Error('Configura DATABASE_URL o PGLITE_DIR en un volumen persistente para producción.');
}

const db = await openDatabase({ connectionString, dataDir: process.env.PGLITE_DIR || './data/stt' });
const app = createApp({
  db, production, jwtSecret: process.env.JWT_SECRET, publicOrigin: process.env.PUBLIC_ORIGIN,
  externalRouter: createWeatherRouter(), staticDir: fileURLToPath(new URL('../dist', import.meta.url)),
});

try {
  await initialize(db, {
    adminPassword: process.env.ADMIN_PASSWORD, techPassword: process.env.TECH_PASSWORD,
    seedDemo: process.env.SEED_DEMO !== 'false',
  });
} catch (error) {
  await db.close();
  throw error;
}
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => console.info(`STT Soporte en el puerto ${port}.`));
let closing = false;
function end() {
  if (closing) return;
  closing = true;
  server.close(async () => { await db.close(); });
}
process.on('SIGTERM', end);
process.on('SIGINT', end);
