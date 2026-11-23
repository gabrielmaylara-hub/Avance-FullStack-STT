import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pagination, validateSolicitud } from '../backend/validation.js';

const datos = {
  cliente: 'CLI-055', titulo: 'Actualizar sistema', descripcion: 'Instalar la actualización del sistema.',
  categoria: 'Soporte', prioridad: 'Alta', estado: 'Pendiente'
};

test('Paginación usa cinco resultados iniciales y admite parámetros numéricos de URL', () => {
  assert.deepEqual(pagination({}), { pagina: 1, limite: 5 });
  assert.deepEqual(pagination({ pagina: '2', limite: '3' }), { pagina: 2, limite: 3 });
});

test('Paginación descarta valores fraccionarios, negativos y tamaños fuera de rango', () => {
  for (const params of [{ pagina: '2.1' }, { pagina: '-1' }, { limite: '0' }, { limite: '999999' }]) {
    assert.throws(() => pagination(params));
  }
});

test('La validación normaliza el cliente y los espacios exteriores del título', () => {
  const result = validateSolicitud({ ...datos, cliente: ' cli-055 ', titulo: ' Actualizar sistema ' });
  assert.equal(result.cliente, datos.cliente);
  assert.equal(result.titulo, datos.titulo);
});

test('La validación de solicitudes exige formato de cliente y longitudes válidas', () => {
  for (const invalid of [{ cliente: '055' }, { titulo: 'A' }, { titulo: 'a'.repeat(121) }, { descripcion: 'breve' }]) {
    assert.throws(() => validateSolicitud({ ...datos, ...invalid }));
  }
});

test('Estado, prioridad y categoría admiten sólo valores de sus catálogos', () => {
  for (const invalid of [{ estado: 'Nuevo' }, { prioridad: 'Normal' }, { categoria: 'Otro' }]) {
    assert.throws(() => validateSolicitud({ ...datos, ...invalid }));
  }
});
