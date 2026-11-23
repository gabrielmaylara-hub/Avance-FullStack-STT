import type { ReactNode } from "react";
import { AlertCircle, ChevronRight, Monitor, Wifi, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { mensaje } from "./datos";

export function Marca() {
  return <div className="marca"><span className="marca-sello" aria-hidden="true">stt<span>·</span></span>
    <span>Soluciones Tecnológicas<strong>de Tabasco</strong></span></div>;
}
export function Insignia({ valor }: { valor: string }) {
  const tono: Record<string, string> = { Pendiente: "ambar", "En proceso": "azul", Resuelta: "verde", Alta: "naranja", "Crítica": "rojo" };
  return <span className={"insignia tono-" + (tono[valor] || "neutro")}><i />{valor}</span>;
}
export function IconoCategoria({ categoria }: { categoria: string }) {
  const Icono = categoria === "Redes" ? Wifi : categoria === "Mantenimiento" ? Wrench : Monitor;
  return <span className="categoria-icono"><Icono size={19} aria-hidden="true" /></span>;
}
export function AvisoError({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return <div role="alert" className="aviso-error"><AlertCircle size={17}/><span>{typeof error === "string" ? error : mensaje(error)}</span>
    {reintentar && <button type="button" onClick={reintentar}>Reintentar</button>}</div>;
}
export function Cabecera({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return <header className="cabecera"><div><h1>{titulo}</h1>{texto && <p>{texto}</p>}</div>{accion}</header>;
}
export function Cargando({ texto = "Consultando…" }: { texto?: string }) {
  return <p className="cargando" role="status"><i aria-hidden="true"/>{texto}</p>;
}
export function Regresar({ to = "/solicitudes", texto = "Solicitudes" }: { to?: string; texto?: string }) {
  return <Link className="regresar" to={to}><ChevronRight size={16}/>{texto}</Link>;
}
