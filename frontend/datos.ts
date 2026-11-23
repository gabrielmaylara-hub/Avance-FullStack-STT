import { useEffect, useState } from "react";

export type Usuario = { id: string; usuario: string; nombre: string; rol: "administrador" | "tecnico" };
export type Formulario = { cliente: string; titulo: string; descripcion: string; categoria: string; prioridad: string; estado: string };
export type Solicitud = Formulario & { id: number; folio: string; creado: string; actualizado: string; version: number };
export type Movimiento = { id: number; folio: string; accion: string; detalle: string; nombre: string; fecha: string };
export type Resumen = { total: number; pendientes: number; proceso: number; resueltas: number; prioritarias: number };
export type Pagina = { pagina: number; limite: number; total: number; totalPaginas: number };
export type Clima = {
  ubicacion: string; temperaturaC: number; sensacionC: number; precipitacionMm: number;
  condicion: string; fechaHora: string; zonaHoraria: string; fuente: string; fuenteUrl: string;
};
export const categorias = ["Mantenimiento", "Soporte", "Redes"];
export const prioridades = ["Baja", "Media", "Alta", "Crítica"];
export const estados = ["Pendiente", "En proceso", "Resuelta"];
export const fecha = (v: string, hora = false) => new Intl.DateTimeFormat("es-MX", {
  day: "2-digit", month: "short", year: hora ? "numeric" : undefined,
  hour: hora ? "2-digit" : undefined, minute: hora ? "2-digit" : undefined, timeZone: "America/Mexico_City"
}).format(new Date(v));

export class ErrorApi extends Error {
  status: number;
  constructor(status: number, mensaje: string) { super(mensaje); this.status = status; }
}
export async function api<T>(path: string, opciones: RequestInit = {}): Promise<T> {
  const headers = new Headers(opciones.headers);
  if (opciones.body) headers.set("Content-Type", "application/json");
  let respuesta: Response;
  try {
    respuesta = await fetch("/api" + path, { ...opciones, credentials: "same-origin", headers });
  } catch (error) {
    if (opciones.signal?.aborted) throw error;
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }
  if (respuesta.status === 401 && !["/auth/login", "/auth/me"].includes(path)) {
    window.dispatchEvent(new Event("stt:sesion-vencida"));
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos?.error || "El servidor no pudo completar la operación.");
  }
  if (!datos) throw new Error("El servidor envió una respuesta que no se pudo leer.");
  return datos as T;
}
export const mensaje = (error: unknown) => error instanceof Error ? error.message : "Ocurrió un error de conexión.";

// Una navegación cancela la petición anterior para que una respuesta tardía no reemplace la vista actual.
export function useRecurso<T>(ruta: string | null) {
  const [revision, setRevision] = useState(0);
  const [respuesta, guardar] = useState<{ ruta: string; revision: number; datos?: T; error?: Error }>();
  useEffect(() => {
    if (!ruta) return;
    const controlador = new AbortController();
    api<T>(ruta, { signal: controlador.signal }).then(datos => {
      if (!controlador.signal.aborted) guardar({ ruta, revision, datos });
    }).catch((error: Error) => {
      if (!controlador.signal.aborted) guardar({ ruta, revision, error });
    });
    return () => controlador.abort();
  }, [ruta, revision]);
  const actual = respuesta?.ruta === ruta && respuesta?.revision === revision ? respuesta : undefined;
  return {
    datos: actual?.datos, error: actual?.error, cargando: Boolean(ruta) && !actual,
    recargar: () => setRevision(actual => actual + 1)
  };
}
