import { ApiError } from "../lib/http";
export const CATEGORIAS = ["Mantenimiento", "Soporte", "Redes"] as const;
export const PRIORIDADES = ["Baja", "Media", "Alta", "Crítica"] as const;
export const ESTADOS = ["Pendiente", "En proceso", "Resuelta"] as const;
export interface SolicitudInput { cliente: string; titulo: string; descripcion: string; categoria: string; prioridad: string; estado: string; }
export interface SolicitudRow extends SolicitudInput { id: number; creado: string; actualizado: string; creado_por: string; version: number; }
export interface Usuario { id: string; usuario: string; nombre: string; rol: "administrador" | "tecnico"; }
export function validateSolicitud(data: Record<string, unknown>): SolicitudInput {
  const text = (field: string, min: number, max: number) => {
    const value = typeof data[field] === "string" ? (data[field] as string).trim() : "";
    if (value.length < min || value.length > max) throw new ApiError(400, `El campo ${field} debe tener de ${min} a ${max} caracteres.`);
    return value;
  };
  const cliente = text("cliente", 7, 12).toUpperCase();
  if (!/^CLI-\d{3,8}$/.test(cliente)) throw new ApiError(400, "El código de cliente debe tener el formato CLI-001.");
  const categoria = text("categoria", 1, 30), prioridad = text("prioridad", 1, 15), estado = text("estado", 1, 15);
  if (!(CATEGORIAS as readonly string[]).includes(categoria)) throw new ApiError(400, "Selecciona una categoría válida.");
  if (!(PRIORIDADES as readonly string[]).includes(prioridad)) throw new ApiError(400, "Selecciona una prioridad válida.");
  if (!(ESTADOS as readonly string[]).includes(estado)) throw new ApiError(400, "Selecciona un estado válido.");
  return { cliente, titulo: text("titulo", 3, 120), descripcion: text("descripcion", 10, 1000), categoria, prioridad, estado };
}
