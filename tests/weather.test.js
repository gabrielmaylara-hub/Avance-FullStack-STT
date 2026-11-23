import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherReader, normalizeWeather } from '../backend/weather.js';

const sample = {
  timezone: 'America/Mexico_City',
  current_units: {temperature_2m:'°C', apparent_temperature:'°C', precipitation:'mm'},
  current: {time:'2026-11-23T08:15', temperature_2m:25, apparent_temperature:28, precipitation:0, weather_code:2}
};

test('Interpreta la lectura, la hora local y las unidades de Open-Meteo', () => {
  const reading = normalizeWeather(sample);
  assert.equal(reading.condicion, 'Parcialmente nublado');
  assert.equal(reading.temperaturaC, 25);
  assert.equal(reading.precipitacionMm, 0);
  assert.equal(reading.fechaHora, '2026-11-23T08:15');
});

test('Rechaza una respuesta incompleta, unidades distintas o valores no numéricos', () => {
  for (const invalid of [null, {}, {...sample,current_units:{}}, {...sample,current:{...sample.current,temperature_2m:null}}]) {
    assert.throws(() => normalizeWeather(invalid), /lectura incompleta/);
  }
});

test('Unifica dos consultas simultáneas y vuelve al proveedor después de diez minutos', async () => {
  let calls = 0, clock = 0;
  const read = createWeatherReader({now: () => clock, fetchImpl: async url => {
    calls++;
    assert.equal(url.hostname, 'api.open-meteo.com');
    assert.equal(url.searchParams.get('timezone'), sample.timezone);
    return Response.json(sample);
  }});
  await Promise.all([read(),read()]);
  clock = 599999;
  await read();
  assert.equal(calls,1);
  clock = 600000;
  await read();
  assert.equal(calls,2);
});

test('Una falla temporal del proveedor permite volver a consultar', async () => {
  let attempt = 0;
  const read = createWeatherReader({fetchImpl: async () => ++attempt === 1
    ? new Response(null,{status:429}) : Response.json(sample)});
  await assert.rejects(read(), /ocupado/);
  assert.equal((await read()).fuente, 'Open-Meteo');
});

test('Convierte errores de red, JSON inválido y vencimiento en mensajes para el usuario', async () => {
  const badJson = createWeatherReader({fetchImpl: async () => new Response('{')});
  const noNetwork = createWeatherReader({fetchImpl: async () => {throw new TypeError('fetch failed');}});
  const tooSlow = createWeatherReader({fetchImpl: async () => {throw new DOMException('timeout','TimeoutError');}});
  await assert.rejects(badJson(), /No fue posible/);
  await assert.rejects(noNetwork(), /No fue posible/);
  await assert.rejects(tooSlow(), /tardó demasiado/);
});
