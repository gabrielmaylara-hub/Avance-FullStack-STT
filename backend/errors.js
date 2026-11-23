import { debuglog } from 'node:util';

const debug = debuglog('stt');

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = 500;
  let message = 'No fue posible completar la operación.';
  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'El contenido JSON no es válido.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    message = 'La solicitud es demasiado extensa.';
  } else if (error.type === 'encoding.unsupported' || error.type === 'charset.unsupported') {
    status = 415;
    message = 'La codificación del contenido no es compatible.';
  } else if (['ECONNREFUSED', 'ECONNRESET', '57P01', '57P03', '53300'].includes(error.code)) {
    status = 503;
    message = 'La base de datos no está disponible.';
  }
  // La traza omite datos del formulario, cookies, tokens y credenciales de conexión.
  debug('%s %s → %d (%s)', req.method, req.route?.path ?? 'middleware', status, error.code ?? error.name);
  res.status(status).json({ error: message });
}
