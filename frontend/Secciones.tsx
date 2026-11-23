import { Activity, CloudSun, Droplets, Edit3, MapPin, Plus, RefreshCw, Thermometer, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { fecha, useRecurso, type Clima, type Movimiento, type Usuario } from "./datos";
import { AvisoError, Cabecera, Cargando, Regresar } from "./ui";

export function Actividad() {
  const datos = useRecurso<{ actividad: Movimiento[] }>("/actividad");
  return <><Cabecera titulo="Actividad reciente" texto="Consulta los últimos 50 movimientos del equipo."
    accion={<button className="boton secundario" onClick={datos.recargar} disabled={datos.cargando}><RefreshCw size={16}/>Actualizar</button>}/>
    {datos.error && <AvisoError error={datos.error} reintentar={datos.recargar}/>}
    {datos.cargando && <Cargando/>}
    {datos.datos && <section className="panel"><div className="panel-titulo"><h2>Historial de atención</h2></div>
      {datos.datos.actividad.length ? <ol className="historial">{datos.datos.actividad.map(m => {
        const Icono = m.accion === "Eliminación" ? Trash2 : m.accion === "Creación" ? Plus : Edit3;
        return <li key={m.id}><span className="evento-icono"><Icono size={16}/></span><div><strong>{m.accion} de {m.folio}</strong>
          <p>{m.detalle}</p><small>{m.nombre} · {fecha(m.fecha, true)}</small></div></li>;
      })}</ol> : <div className="vacio"><Activity size={24}/><h3>Aún no hay movimientos</h3></div>}</section>}
  </>;
}
const decimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
function horaLocal(isoLocal: string) {
  // Open-Meteo envía la hora de la localidad sin desplazamiento UTC.
  const [dia, hora] = isoLocal.split("T");
  const [a, m, d] = dia.split("-");
  return d + "/" + m + "/" + a + " · " + (hora || "").slice(0,5);
}
export function ClimaVisitas() {
  const clima = useRecurso<{ data: Clima }>("/clima");
  const dato = clima.datos?.data;
  return <><Cabecera titulo="Clima para visitas" texto="Consulta las condiciones en Villahermosa antes de salir a un servicio."
    accion={<button className="boton secundario" onClick={clima.recargar} disabled={clima.cargando}><RefreshCw size={16}/>Actualizar clima</button>}/>
    {clima.error && <AvisoError error={clima.error} reintentar={clima.recargar}/>}
    {clima.cargando && <Cargando texto="Consultando las condiciones del tiempo…"/>}
    {dato && <section className="panel clima"><div className="clima-destacado"><div><span className="ubicacion"><MapPin size={16}/>{dato.ubicacion}</span>
      <strong>{decimal.format(dato.temperaturaC)}<small> °C</small></strong><h2>{dato.condicion}</h2></div><CloudSun className="clima-icono" strokeWidth={1.2} aria-hidden="true" size={84}/></div>
      <dl className="clima-medidas"><div><dt><Thermometer size={17}/>Sensación térmica</dt><dd>{decimal.format(dato.sensacionC)} °C</dd></div>
        <div><dt><Droplets size={17}/>Precipitación</dt><dd>{decimal.format(dato.precipitacionMm)} mm</dd></div></dl>
      <div className="clima-fuente"><span>Hora local de la medición <strong>{horaLocal(dato.fechaHora)}</strong><small>{dato.zonaHoraria}</small></span>
        <a href={dato.fuenteUrl} target="_blank" rel="noreferrer">{dato.fuente} ↗</a></div>
    </section>}</>;
}
export function Guia({ usuario }: { usuario: Usuario }) {
  return <><Cabecera titulo="Guía del sistema" texto="Cómo registrar y dar seguimiento a un caso de soporte."/>
    <section className="panel guia"><div><h2>Registrar un caso</h2><p>En <Link to="/solicitudes/nueva">Nueva solicitud</Link>, escribe el código de cliente, el título y la descripción. Selecciona categoría, prioridad y estado. Al guardar, el sistema asigna el folio.</p></div>
      <div><h2>Localizar una solicitud</h2><p>En <Link to="/solicitudes">Solicitudes</Link>, introduce un folio, título o código de cliente y pulsa Buscar. Combina la búsqueda con los filtros de estado, categoría y prioridad.</p></div>
      <div><h2>Actualizar el servicio</h2><p>Abre el título de un caso y selecciona Editar solicitud. Si alguien ya modificó esa versión, abre los datos actuales antes de guardar de nuevo.</p></div>
      <div><h2>Preparar una visita</h2><p>Abre <Link to="/clima">Clima para visitas</Link> para revisar la temperatura y precipitación en Villahermosa y la hora de la medición.</p></div>
      {usuario.rol === "administrador" && <div><h2>Revisar movimientos o eliminar</h2><p>Consulta las altas, cambios y eliminaciones en <Link to="/actividad">Actividad reciente</Link>. El detalle de cada solicitud incluye la opción de eliminar con confirmación.</p></div>}
    </section></>;
}
export function SinAcceso({ faltante = false }: { faltante?: boolean }) {
  return <><Regresar/><Cabecera titulo={faltante ? "Página no encontrada" : "Acceso restringido"} texto={faltante ? "Revisa la dirección o vuelve al listado de solicitudes." : "El historial de actividad está disponible para el administrador."}/></>;
}
