import path from 'node:path';
import express from 'express';
import { authHandlers } from './auth.js';
import { HttpError, errorHandler } from './errors.js';
import { solicitudesRouter } from './solicitudes.js';
import { credentials, validate } from './validation.js';

export function createApp({ db, jwtSecret, production = false, publicOrigin, externalRouter, staticDir }) {
  if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) throw new Error('JWT_SECRET requiere al menos 32 caracteres.');
  const origin = publicOrigin ? new URL(publicOrigin).origin : null;
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    if (production) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  const api = express.Router();
  app.use('/api', api);
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const expected = origin ?? `${production ? 'https' : req.protocol}://${req.get('host')}`;
      if (req.get('origin') && req.get('origin') !== expected) throw new HttpError(403, 'El origen de la solicitud no está permitido.');
    }
    next();
  });
  api.use(express.json({ limit: 8000 }));
  const auth = authHandlers(db, jwtSecret, production);
  const needsJson = (req, _res, next) => {
    if (!req.is('application/json')) throw new HttpError(415, 'Envía los datos como JSON.');
    next();
  };
  api.get('/salud', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ estado: 'ok', baseDeDatos: 'conectada', aplicacion: 'STT Soporte' });
  });
  api.post('/auth/login', needsJson, validate('body', credentials), auth.login);
  api.use(auth.authenticate);
  api.get('/auth/me', (req, res) => res.json({ usuario: req.user }));
  api.post('/auth/logout', auth.logout);
  api.use((req, res, next) => ['POST', 'PUT', 'DELETE'].includes(req.method) ? needsJson(req, res, next) : next());
  api.use(solicitudesRouter(db));
  if (externalRouter) api.use(externalRouter);
  api.use((_req, _res, next) => next(new HttpError(404, 'La ruta solicitada no existe.')));
  if (staticDir) {
    const absolute = path.resolve(staticDir);
    app.use(express.static(absolute));
    app.get('/{*path}', (req, res, next) => {
      if (path.extname(req.path) || !req.accepts('html')) return next();
      res.sendFile(path.join(absolute, 'index.html'));
    });
  }
  app.use((_req, res) => res.status(404).json({ error: 'La ruta solicitada no existe.' }));
  app.use(errorHandler);
  return app;
}
