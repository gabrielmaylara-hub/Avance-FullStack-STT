import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { Router } from 'express';
import pg from 'pg';
import { createApp } from '../backend/app.js';
import { initialize, openDatabase } from '../backend/db.js';

const adminPassword = randomBytes(24).toString('hex');
const techPassword = randomBytes(24).toString('hex');
const jwtSecret = randomBytes(48).toString('hex');
const plantilla = {
  cliente: 'CLI-901', titulo: 'Revisión de enlace',
  descripcion: 'Comprobar la conectividad del equipo de pruebas.',
  categoria: 'Redes', prioridad: 'Media', estado: 'Pendiente'
};
let db, maintenance, temporaryDatabase, server, baseUrl, admin, tecnico;

async function request(path, { method = 'GET', cookie, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (cookie) requestHeaders.Cookie = cookie;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  const response = await fetch(baseUrl + path, {
    method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, headers: response.headers, data: await response.json() };
}

async function login(usuario, password) {
  const result = await request('/api/auth/login', { method: 'POST', body: { usuario, password } });
  assert.equal(result.status, 200);
  const setCookie = result.headers.get('set-cookie');
  assert.ok(setCookie);
  return { ...result, setCookie, cookie: setCookie.split(';')[0] };
}

async function createTicket(cookie, overrides = {}) {
  const result = await request('/api/solicitudes', {
    method: 'POST', cookie, body: { ...plantilla, ...overrides }
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data.solicitud;
}

before(async () => {
  // Con una URL administrativa de pruebas se crea una base nueva y exclusiva de esta ejecución.
  // Sin esa variable, las pruebas utilizan PostgreSQL embebido en memoria.
  let connectionString;
  if (process.env.STT_TEST_POSTGRES_ADMIN_URL) {
    const url = new URL(process.env.STT_TEST_POSTGRES_ADMIN_URL);
    maintenance = new pg.Client({ connectionString: url.href });
    await maintenance.connect();
    const name = 'stt_test_' + randomUUID().replaceAll('-', '');
    await maintenance.query('CREATE DATABASE ' + name);
    temporaryDatabase = name;
    url.pathname = '/' + name;
    connectionString = url.href;
  }
  db = await openDatabase({ connectionString });
  await initialize(db, { adminPassword, techPassword, seedDemo: true });
  const app = createApp({ db, jwtSecret, externalRouter: Router() });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  admin = await login('admin@stt.test', adminPassword);
  tecnico = await login('tecnico@stt.test', techPassword);
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  try {
    if (db) await db.close();
  } finally {
    if (maintenance) {
      try {
        if (temporaryDatabase) await maintenance.query('DROP DATABASE ' + temporaryDatabase);
      } finally {
        await maintenance.end();
      }
    }
  }
});

test('Salud pública comprueba la conexión y las solicitudes requieren sesión', async () => {
  const health = await request('/api/salud');
  assert.equal(health.status, 200);
  assert.equal(health.data.baseDeDatos, 'conectada');
  const denied = await request('/api/solicitudes');
  assert.equal(denied.status, 401);
  assert.equal(typeof denied.data.error, 'string');
});

test('El acceso identifica el rol, usa cookie HttpOnly y no entrega secretos en JSON', async () => {
  assert.equal(admin.data.usuario.rol, 'administrador');
  assert.equal(tecnico.data.usuario.rol, 'tecnico');
  assert.match(tecnico.setCookie, /HttpOnly/i);
  assert.match(tecnico.setCookie, /SameSite=Strict/i);
  assert.equal('password_hash' in tecnico.data.usuario, false);
  assert.equal('token' in tecnico.data, false);
  const session = await request('/api/auth/me', { cookie: tecnico.cookie });
  assert.equal(session.data.usuario.usuario, 'tecnico@stt.test');
});

test('Una contraseña incorrecta no inicia sesión', async () => {
  const invalid = await request('/api/auth/login', {
    method: 'POST', body: { usuario: 'tecnico@stt.test', password: 'valor-de-prueba-incorrecto' }
  });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.headers.get('set-cookie'), null);
});

test('El administrador y el técnico tienen permisos distintos sobre actividad y eliminación', async () => {
  const ticket = await createTicket(tecnico.cookie);
  const activity = await request('/api/actividad', { cookie: tecnico.cookie });
  assert.equal(activity.status, 403);
  const forbidden = await request('/api/solicitudes/' + ticket.id, {
    method: 'DELETE', cookie: tecnico.cookie, body: { version: ticket.version }
  });
  assert.equal(forbidden.status, 403);
  const detail = await request('/api/solicitudes/' + ticket.id, { cookie: tecnico.cookie });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.solicitud.folio, ticket.folio);

  const removal = await request('/api/solicitudes/' + ticket.id, {
    method: 'DELETE', cookie: admin.cookie, body: { version: ticket.version }
  });
  assert.equal(removal.status, 200);
  assert.equal((await request('/api/solicitudes/' + ticket.id, { cookie: admin.cookie })).status, 404);
  const history = await request('/api/actividad', { cookie: admin.cookie });
  assert.equal(history.status, 200);
  const actions = history.data.actividad.filter(a => a.folio === ticket.folio).map(a => a.accion).sort();
  assert.deepEqual(actions, ['Creación', 'Eliminación']);
});

test('Dos ediciones de la misma versión producen un éxito y un conflicto, con una sola entrada de actividad', async () => {
  const ticket = await createTicket(admin.cookie);
  const path = '/api/solicitudes/' + ticket.id;
  const edits = await Promise.all(['Primer diagnóstico', 'Segundo diagnóstico'].map(titulo =>
    request(path, { method: 'PUT', cookie: tecnico.cookie, body: { ...plantilla, titulo, version: ticket.version } })
  ));
  assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
  const winner = edits.find(r => r.status === 200).data.solicitud;
  assert.equal(winner.version, ticket.version + 1);
  const staleDelete = await request(path, { method: 'DELETE', cookie: admin.cookie, body: { version: ticket.version } });
  assert.equal(staleDelete.status, 409);
  const detail = await request(path, { cookie: admin.cookie });
  assert.equal(detail.data.solicitud.titulo, winner.titulo);
  const history = await request('/api/actividad', { cookie: admin.cookie });
  const updates = history.data.actividad.filter(a => a.folio === ticket.folio && a.accion === 'Actualización');
  assert.equal(updates.length, 1);
});

test('Paginación con filtros conserva el total, el orden y la separación de páginas', async () => {
  const ids = [];
  for (const suffix of ['uno', 'dos', 'tres']) {
    const ticket = await createTicket(admin.cookie, { titulo: 'Serie router ' + suffix });
    ids.push(ticket.id);
  }
  await createTicket(admin.cookie, { titulo: 'Serie router excluida', estado: 'Resuelta' });
  const query = new URLSearchParams({
    q: 'Serie router', estado: 'Pendiente', categoria: 'Redes', prioridad: 'Media', limite: '2'
  });
  const page = numero => request('/api/solicitudes?' + query + '&pagina=' + numero, { cookie: tecnico.cookie });
  const [one, two, empty] = await Promise.all([page(1), page(2), page(3)]);
  assert.deepEqual(one.data.paginacion, { pagina: 1, limite: 2, total: 3, totalPaginas: 2 });
  assert.deepEqual(two.data.paginacion, { pagina: 2, limite: 2, total: 3, totalPaginas: 2 });
  assert.deepEqual(one.data.solicitudes.map(s => s.id), [ids[2], ids[1]]);
  assert.deepEqual(two.data.solicitudes.map(s => s.id), [ids[0]]);
  assert.deepEqual(empty.data.solicitudes, []);
});

test('El buscador trata apóstrofo, porcentaje y guion bajo como texto de la solicitud', async () => {
  const titulo = "Equipo de O'Neill al 100%_LAN";
  const expected = await createTicket(admin.cookie, { titulo });
  await createTicket(admin.cookie, { titulo: "Equipo de O'Neill al 100XXLAN" });
  for (const q of [titulo, '%_LAN']) {
    const response = await request('/api/solicitudes?' + new URLSearchParams({ q }), { cookie: tecnico.cookie });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data.solicitudes.map(s => s.id), [expected.id]);
  }
});

test('La validación rechaza los campos inválidos y evita altas parciales', async () => {
  const result = await request('/api/solicitudes', {
    method: 'POST', cookie: admin.cookie, body: { ...plantilla, titulo: 'Solicitud rechazada QA', categoria: 'Sin catálogo' }
  });
  assert.equal(result.status, 400);
  assert.equal(typeof result.data.error, 'string');
  const search = await request('/api/solicitudes?' + new URLSearchParams({ q: 'Solicitud rechazada QA' }), { cookie: admin.cookie });
  assert.equal(search.data.paginacion.total, 0);

  const badPage = await request('/api/solicitudes?pagina=0', { cookie: admin.cookie });
  assert.equal(badPage.status, 400);
});

test('Una petición de escritura con otro origen se rechaza', async () => {
  const result = await request('/api/solicitudes', {
    method: 'POST', cookie: admin.cookie, headers: { Origin: 'https://otro-origen.example' }, body: plantilla
  });
  assert.equal(result.status, 403);
});

test('Cerrar sesión revoca la cookie previamente emitida', async () => {
  const session = await login('tecnico@stt.test', techPassword);
  const logout = await request('/api/auth/logout', { method: 'POST', cookie: session.cookie, body: {} });
  assert.equal(logout.status, 200);
  assert.equal((await request('/api/auth/me', { cookie: session.cookie })).status, 401);
});

test('La sesión expirada se rechaza al superar una hora', async t => {
  const session = await login('tecnico@stt.test', techPassword);
  const now = Date.now();
  t.mock.timers.enable({ apis: ['Date'], now });
  t.mock.timers.setTime(now + 61 * 60 * 1000);
  const expired = await request('/api/auth/me', { cookie: session.cookie });
  assert.equal(expired.status, 401);
});
