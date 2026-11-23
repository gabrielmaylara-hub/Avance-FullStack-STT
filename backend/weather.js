import { Router } from 'express';
import { HttpError } from './errors.js';

const provider = 'https://api.open-meteo.com/v1/forecast';
const zone = 'America/Mexico_City';
const labels = new Map([
  [0, 'Cielo despejado'], [1, 'Mayormente despejado'], [2, 'Parcialmente nublado'],
  [3, 'Nublado'], [45, 'Niebla'], [48, 'Niebla con escarcha'],
  [51, 'Llovizna ligera'], [53, 'Llovizna moderada'], [55, 'Llovizna intensa'],
  [56, 'Llovizna helada ligera'], [57, 'Llovizna helada intensa'],
  [61, 'Lluvia ligera'], [63, 'Lluvia moderada'], [65, 'Lluvia intensa'],
  [66, 'Lluvia helada ligera'], [67, 'Lluvia helada intensa'],
  [71, 'Nevada ligera'], [73, 'Nevada moderada'], [75, 'Nevada intensa'], [77, 'Granos de nieve'],
  [80, 'Chubascos ligeros'], [81, 'Chubascos moderados'], [82, 'Chubascos fuertes'],
  [85, 'Chubascos de nieve ligeros'], [86, 'Chubascos de nieve intensos'],
  [95, 'Tormenta eléctrica'], [96, 'Tormenta con granizo ligero'], [99, 'Tormenta con granizo fuerte']
]);

export function normalizeWeather(payload) {
  const reading = payload?.current;
  const units = payload?.current_units;
  const validTime = typeof reading?.time === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(reading.time) &&
    Number.isFinite(Date.parse(reading.time + 'Z'));
  if (!validTime || payload.timezone !== zone ||
      units?.temperature_2m !== '°C' || units.apparent_temperature !== '°C' || units.precipitation !== 'mm' ||
      ![reading.temperature_2m, reading.apparent_temperature, reading.precipitation].every(Number.isFinite) ||
      reading.precipitation < 0 || !Number.isInteger(reading.weather_code)) {
    throw new HttpError(502, 'El proveedor devolvió una lectura incompleta. Vuelve a consultar en unos minutos.');
  }

  return {
    ubicacion: 'Villahermosa, Tabasco', temperaturaC: reading.temperature_2m,
    sensacionC: reading.apparent_temperature, precipitacionMm: reading.precipitation,
    condicion: labels.get(reading.weather_code) ?? 'Condición sin clasificar',
    fechaHora: reading.time, zonaHoraria: zone, fuente: 'Open-Meteo', fuenteUrl: 'https://open-meteo.com/'
  };
}

// Las coordenadas corresponden a la ciudad donde se realizan las visitas de soporte.
export function createWeatherReader({ fetchImpl = fetch, now = Date.now, timeoutMs = 8000 } = {}) {
  const url = new URL(provider);
  url.search = new URLSearchParams({
    latitude: '17.99', longitude: '-92.95',
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code', timezone: zone
  }).toString();
  let cache;
  let pending;

  async function requestReading() {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' } });
      if (!response.ok) {
        if (response.status === 429 || response.status === 503) {
          throw new HttpError(503, 'El servicio de clima está ocupado. Inténtalo de nuevo en unos minutos.');
        }
        throw new HttpError(502, 'El proveedor de clima no pudo atender la consulta.');
      }
      const data = normalizeWeather(await response.json());
      cache = { data, until: now() + 10 * 60_000 };
      return data;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (signal.aborted || error.name === 'TimeoutError') {
        throw new HttpError(504, 'El proveedor de clima tardó demasiado en responder.');
      }
      throw new HttpError(502, 'No fue posible obtener las condiciones del tiempo.');
    }
  }

  return function read() {
    if (cache && now() < cache.until) return Promise.resolve(cache.data);
    pending ??= requestReading().finally(() => { pending = undefined; });
    return pending;
  };
}

export function createWeatherRouter(options) {
  const router = Router();
  const read = createWeatherReader(options);
  router.get('/clima', async (_req, res) => res.json({ data: await read() }));
  return router;
}
