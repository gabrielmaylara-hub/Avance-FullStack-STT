import { useEffect, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, ListFilter, Plus, RefreshCw, Search } from "lucide-react";
import { categorias, estados, fecha, prioridades, useRecurso, type Pagina, type Resumen, type Solicitud } from "./datos";
import { AvisoError, Cabecera, Cargando, IconoCategoria, Insignia } from "./ui";

export default function Solicitudes() {
  const [params, cambiarParams] = useSearchParams();
  const location = useLocation();
  const consulta = params.toString();
  const lista = useRecurso<{ solicitudes: Solicitud[]; paginacion: Pagina }>("/solicitudes" + (consulta ? "?" + consulta : ""));
  const estadisticas = useRecurso<{ resumen: Resumen }>("/resumen");
  const salto = lista.datos?.paginacion;
  const totalPaginas = salto ? Math.max(1, salto.totalPaginas) : 0;
  useEffect(() => {
    if (salto && salto.pagina > totalPaginas) {
      const ajustado = new URLSearchParams(params);
      ajustado.set("pagina", String(totalPaginas));
      cambiarParams(ajustado, { replace: true });
    }
  }, [salto, totalPaginas, params, cambiarParams]);
  function aplicar(nombre: string, valor: string) {
    const siguiente = new URLSearchParams(params);
    if (valor) siguiente.set(nombre, valor);
    else siguiente.delete(nombre);
    if (nombre !== "pagina") siguiente.delete("pagina");
    cambiarParams(siguiente);
  }
  function buscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    aplicar("q", String(new FormData(evento.currentTarget).get("q") || "").trim());
  }
  const filtrando = ["q", "categoria", "prioridad", "estado"].some(k => Boolean(params.get(k)));
  const resumen = estadisticas.datos?.resumen;
  const tarjetas = [
    { etiqueta: "Total de solicitudes", valor: resumen?.total, icono: FileText, tono: "neutro" },
    { etiqueta: "Pendientes", valor: resumen?.pendientes, icono: Clock3, tono: "ambar" },
    { etiqueta: "En proceso", valor: resumen?.proceso, icono: RefreshCw, tono: "azul" },
    { etiqueta: "Resueltas", valor: resumen?.resueltas, icono: CheckCircle2, tono: "verde" }
  ];
  const volver = { lista: location.pathname + location.search };
  return <>
    <Cabecera titulo="Solicitudes" texto="Consulta los casos de mantenimiento, soporte y redes."
      accion={<Link className="boton primario" to="nueva" state={volver}><Plus size={17}/>Nueva solicitud</Link>} />
    {estadisticas.error && <AvisoError error={estadisticas.error} reintentar={estadisticas.recargar}/>}
    <section className="indicadores" aria-label="Resumen general">
      {tarjetas.map(({ etiqueta, valor, icono: Icono, tono }) => <div className="indicador" key={etiqueta}>
        <div><span>{etiqueta}</span><strong>{valor ?? "—"}</strong></div><span className={"indicador-icono tono-" + tono}><Icono size={20}/></span>
      </div>)}
    </section>
    <section className="panel registro">
      <div className="panel-titulo"><h2>Registro de solicitudes</h2><button className="icon-button" onClick={() => { lista.recargar(); estadisticas.recargar(); }} aria-label="Actualizar lista"><RefreshCw size={17}/></button></div>
      <div className="pestanas" role="group" aria-label="Filtrar por estado">
        {["", ...estados].map(estado => <button key={estado} aria-pressed={(params.get("estado") || "") === estado}
          onClick={() => aplicar("estado", estado)}>{estado || "Todas"}</button>)}
      </div>
      <div className="filtros">
        <form role="search" className="busqueda" onSubmit={buscar}>
          <Search aria-hidden="true" size={16}/><input type="search" key={params.get("q") || ""} name="q" defaultValue={params.get("q") || ""} aria-label="Buscar solicitudes" placeholder="Folio, título o cliente" maxLength={120}/>
          <button type="submit">Buscar</button>
        </form>
        <select aria-label="Filtrar por categoría" value={params.get("categoria") || ""} onChange={e => aplicar("categoria", e.target.value)}>
          <option value="">Todas las categorías</option>{categorias.map(valor => <option key={valor}>{valor}</option>)}
        </select>
        <select aria-label="Filtrar por prioridad" value={params.get("prioridad") || ""} onChange={e => aplicar("prioridad", e.target.value)}>
          <option value="">Cualquier prioridad</option>{prioridades.map(valor => <option key={valor}>{valor}</option>)}
        </select>
        {filtrando && <button className="accion-texto" onClick={() => cambiarParams({})}>Quitar filtros</button>}
      </div>
      {lista.error && <div className="panel-mensaje"><AvisoError error={lista.error} reintentar={lista.recargar}/></div>}
      {lista.cargando && <Cargando texto="Consultando solicitudes…"/>}
      {lista.datos && <>{lista.datos.solicitudes.length ? <div className="tabla-contenedor"><table className="tabla">
        <thead><tr><th>Solicitud</th><th>Cliente</th><th>Prioridad</th><th>Estado</th><th>Registro</th></tr></thead>
        <tbody>{lista.datos.solicitudes.map(item => <tr key={item.id}>
          <td><div className="caso"><IconoCategoria categoria={item.categoria}/><div><Link to={String(item.id)} state={volver}>{item.titulo}</Link>
            <small>{item.folio}<i>·</i>{item.categoria}</small></div></div></td>
          <td data-campo="Cliente" className="codigo">{item.cliente}</td>
          <td data-campo="Prioridad"><Insignia valor={item.prioridad}/></td><td data-campo="Estado"><Insignia valor={item.estado}/></td>
          <td data-campo="Registro" className="fecha">{fecha(item.creado)}</td>
        </tr>)}</tbody></table></div> : <div className="vacio"><ListFilter size={26}/><h3>{filtrando ? "Sin coincidencias" : "Aún no hay solicitudes"}</h3>
          {filtrando ? <button className="accion-texto" onClick={() => cambiarParams({})}>Quitar filtros para ver todas</button> : <Link to="nueva">Registrar una solicitud</Link>}</div>}
        {salto && <div className="paginador">
          <span aria-live="polite">{salto.total ? `${(salto.pagina - 1) * salto.limite + 1}–${Math.min(salto.pagina * salto.limite, salto.total)} de ${salto.total}` : "0 resultados"}</span>
          <label>Por página <select value={salto.limite} onChange={e => aplicar("limite", e.target.value)}>
            {[...new Set([5, 10, 20, 50, salto.limite])].sort((a,b) => a-b).map(n => <option key={n}>{n}</option>)}</select></label>
          <div className="pagina-botones"><button className="icon-button" aria-label="Página anterior" disabled={salto.pagina <= 1} onClick={() => aplicar("pagina", String(salto.pagina - 1))}><ChevronLeft size={17}/></button>
            <span>{salto.pagina} / {totalPaginas}</span><button className="icon-button" aria-label="Página siguiente" disabled={salto.pagina >= totalPaginas} onClick={() => aplicar("pagina", String(salto.pagina + 1))}><ChevronRight size={17}/></button></div>
        </div>}</>}
    </section>
    {typeof resumen?.prioritarias === "number" && <p className="nota-registro">{resumen.prioritarias} {resumen.prioritarias === 1 ? "solicitud de prioridad alta o crítica por atender" : "solicitudes de prioridad alta o crítica por atender"}</p>}
  </>;
}
