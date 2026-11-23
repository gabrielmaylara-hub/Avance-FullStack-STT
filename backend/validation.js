import { HttpError } from './errors.js';

export const categorias = ['Mantenimiento', 'Soporte', 'Redes'];
export const prioridades = ['Baja', 'Media', 'Alta', 'Crítica'];
export const estados = ['Pendiente', 'En proceso', 'Resuelta'];

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Envía un objeto JSON válido.');
  }
  return value;
}

function textField(value, name, min, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > max || text.includes('\0')) {
    throw new HttpError(400, `El campo ${name} debe tener de ${min} a ${max} caracteres válidos.`);
  }
  return text;
}

function choice(value, choices, name) {
  if (!choices.includes(value)) throw new HttpError(400, `El valor de ${name} no es válido.`);
  return value;
}

export function credentials(data) {
  object(data);
  const usuario = textField(data.usuario, 'usuario', 1, 100).toLowerCase();
  if (typeof data.password !== 'string' || !data.password.length || data.password.length > 200) {
    throw new HttpError(400, 'Escribe una contraseña válida.');
  }
  return { usuario, password: data.password };
}

export function validateSolicitud(data) {
  object(data);
  const cliente = textField(data.cliente, 'cliente', 7, 12).toUpperCase();
  if (!/^CLI-\d{3,8}$/.test(cliente)) throw new HttpError(400, 'El código de cliente debe tener el formato CLI-001.');
  return {
    cliente,
    titulo: textField(data.titulo, 'titulo', 3, 120),
    descripcion: textField(data.descripcion, 'descripcion', 10, 1000),
    categoria: choice(data.categoria, categorias, 'categoría'),
    prioridad: choice(data.prioridad, prioridades, 'prioridad'),
    estado: choice(data.estado, estados, 'estado'),
  };
}

export function version(data) {
  object(data);
  if (!Number.isInteger(data.version) || data.version < 1 || data.version > 2147483647) {
    throw new HttpError(400, 'Falta una versión válida del registro. Actualiza la lista.');
  }
  return data.version;
}

function positive(value, max, label) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value) || Number(value) > max) {
    throw new HttpError(400, `El parámetro ${label} debe ser un entero de 1 a ${max}.`);
  }
  return Number(value);
}

export function pagination(query) {
  return {
    pagina: positive(query.pagina ?? '1', 2147483647, 'pagina'),
    limite: positive(query.limite ?? '5', 50, 'limite'),
  };
}

export function listFilters(data) {
  const q = data.q === undefined || data.q === '' ? '' : textField(data.q, 'q', 0, 120);
  if (data.q !== undefined && typeof data.q !== 'string') throw new HttpError(400, 'La búsqueda debe ser texto.');
  return {
    ...pagination(data),
    q,
    categoria: choice(data.categoria ?? '', ['', ...categorias], 'categoría'),
    estado: choice(data.estado ?? '', ['', ...estados], 'estado'),
    prioridad: choice(data.prioridad ?? '', ['', ...prioridades], 'prioridad'),
  };
}

export function identify(req, _res, next) {
  req.solicitudId = positive(req.params.id, 2147483647, 'id');
  next();
}

export function validate(source, fn) {
  return (req, _res, next) => {
    req.input = fn(req[source]);
    next();
  };
}
