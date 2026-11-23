import { useEffect, useState, type FormEvent } from "react";
import { Activity, ArrowRight, CheckCircle2, CircleHelp, CloudSun, LayoutGrid, LogOut, X } from "lucide-react";
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, ErrorApi, mensaje, type Usuario } from "./datos";
import { AvisoError, Cargando, Marca } from "./ui";
import Caso from "./Caso";
import Solicitudes from "./Solicitudes";
import { Actividad, ClimaVisitas, Guia, SinAcceso } from "./Secciones";

function Ingreso({ autenticar, vencida }: { autenticar: (usuario: Usuario) => void; vencida: boolean }) {
  const [error, informar] = useState("");
  const [ocupado, trabajar] = useState(false);
  async function ingresar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const form = new FormData(e.currentTarget);
    informar(""); trabajar(true);
    try {
      const res = await api<{ usuario: Usuario }>("/auth/login", {
        method: "POST", body: JSON.stringify({ usuario: String(form.get("usuario")).trim(), password: form.get("password") })
      });
      autenticar(res.usuario);
    } catch (err) { informar(mensaje(err)); } finally { trabajar(false); }
  }
  return <main className="ingreso">
    <section className="ingreso-portada"><Marca/><div className="ingreso-titulo"><h1>Centro de<br/><span>soporte.</span></h1>
      <p>Atención y seguimiento de solicitudes de mantenimiento, soporte técnico y redes.</p></div>
      <span className="ingreso-sede">Soluciones Tecnológicas de Tabasco</span></section>
    <section className="ingreso-form"><div><h2>Inicia sesión</h2><p>Ingresa a tu espacio de gestión de solicitudes.</p>
      <form onSubmit={ingresar}><label>Usuario<input type="email" name="usuario" autoComplete="username" placeholder="usuario@stt.test" required maxLength={100}/></label>
        <label>Contraseña<input type="password" name="password" autoComplete="current-password" required maxLength={200}/></label>
        {vencida && !error && <p className="aviso-sesion" role="status">Tu sesión terminó. Ingresa para continuar.</p>}
        {error && <AvisoError error={error}/>}
        <button className="boton primario" disabled={ocupado}>{ocupado ? "Ingresando…" : "Entrar al sistema"}<ArrowRight size={17}/></button>
      </form></div></section>
  </main>;
}
const menu = [
  { to: "/solicitudes", titulo: "Solicitudes", icono: LayoutGrid },
  { to: "/actividad", titulo: "Actividad reciente", icono: Activity },
  { to: "/clima", titulo: "Clima para visitas", icono: CloudSun },
  { to: "/guia", titulo: "Guía del sistema", icono: CircleHelp }
];
function Espacio({ usuario, salir }: { usuario: Usuario; salir: () => void }) {
  const location = useLocation();
  const nav = useNavigate();
  const [ocupado, trabajar] = useState(false);
  const [error, informar] = useState("");
  const [aviso, avisar] = useState("");
  const pagina = menu.find(link => location.pathname.startsWith(link.to))?.titulo || "Mi espacio";
  useEffect(() => {
    const texto = location.state?.aviso;
    if (typeof texto !== "string") return;
    avisar(texto);
    const { aviso: _mensaje, ...resto } = location.state;
    nav(location.pathname + location.search, { replace: true, state: resto });
  }, [location, nav]);
  useEffect(() => {
    if (!aviso) return;
    const temporizador = window.setTimeout(() => avisar(""), 5200);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);
  useEffect(() => { document.title = pagina + " | STT"; }, [pagina]);
  async function cerrar() {
    if (ocupado) return;
    trabajar(true);
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      nav("/ingreso", { replace: true }); salir();
    } catch (err) { informar(mensaje(err)); } finally { trabajar(false); }
  }
  const rol = usuario.rol === "administrador" ? "Administrador" : "Técnico";
  return <div className="aplicacion"><a className="saltar" href="#principal">Saltar al contenido</a>
    <aside className="lateral"><Link className="marca-enlace" to="/solicitudes" aria-label="STT, ir a solicitudes"><Marca/></Link>
      <nav aria-label="Navegación principal">{menu.filter(link => link.to !== "/actividad" || usuario.rol === "administrador").map(({ to, titulo, icono: Icono }) => <NavLink key={to} to={to}><Icono size={18}/><span>{titulo}</span></NavLink>)}</nav>
      <div className="identidad"><span className="avatar">{usuario.nombre.split(" ").filter(Boolean).slice(0,2).map(n => n[0]).join("")}</span>
        <div><strong>{usuario.nombre}</strong><small>{rol}</small></div><button className="icon-button" onClick={cerrar} disabled={ocupado} aria-label="Cerrar sesión"><LogOut size={18}/></button></div>
    </aside>
    <div className="cuerpo"><header className="barra"><div><span>Mi espacio</span><i>/</i>{pagina}</div>
      <span className="nombre-movil">{rol}</span><button className="icon-button salida-movil" onClick={cerrar} disabled={ocupado} aria-label="Cerrar sesión"><LogOut size={17}/></button></header>
      <main id="principal" className="contenido" tabIndex={-1}>{error && <AvisoError error={error} reintentar={cerrar}/>}<Outlet/></main>
    </div>
    {aviso && <div role="status" className="notificacion"><CheckCircle2 size={18}/>{aviso}<button aria-label="Cerrar aviso" onClick={() => avisar("")}><X size={15}/></button></div>}
  </div>;
}
function Aplicacion() {
  const [usuario, autenticar] = useState<Usuario | null>(null);
  const [listo, preparar] = useState(false);
  const [error, informar] = useState("");
  const [revision, reintentar] = useState(0);
  const [vencida, caducar] = useState(false);
  const location = useLocation();
  useEffect(() => {
    const controlador = new AbortController();
    api<{ usuario: Usuario }>("/auth/me", { signal: controlador.signal }).then(d => { if (!controlador.signal.aborted) autenticar(d.usuario); })
      .catch(e => { if (!controlador.signal.aborted && !(e instanceof ErrorApi && e.status === 401)) informar(mensaje(e)); })
      .finally(() => { if (!controlador.signal.aborted) preparar(true); });
    return () => controlador.abort();
  }, [revision]);
  useEffect(() => {
    const finalizar = () => { autenticar(null); caducar(true); };
    window.addEventListener("stt:sesion-vencida", finalizar);
    return () => window.removeEventListener("stt:sesion-vencida", finalizar);
  }, []);
  if (error) return <main className="espera"><Marca/><AvisoError error={error} reintentar={() => { informar(""); preparar(false); reintentar(n => n + 1); }}/></main>;
  if (!listo) return <main className="espera"><Marca/><Cargando texto="Abriendo el sistema…"/></main>;
  const regreso = location.state?.regreso;
  const destino = typeof regreso === "string" && /^\/(solicitudes|actividad|clima|guia)(\/|\?|$)/.test(regreso) ? regreso : "/solicitudes";
  return <Routes>
    <Route path="/ingreso" element={usuario ? <Navigate to={destino} replace/> : <Ingreso vencida={vencida} autenticar={u => { caducar(false); autenticar(u); }}/>}/>
    <Route element={usuario ? <Espacio usuario={usuario} salir={() => { caducar(false); autenticar(null); }}/> :
      <Navigate to="/ingreso" replace state={{ regreso: location.pathname + location.search }}/>}>
      <Route index element={<Navigate to="/solicitudes" replace/>}/>
      <Route path="/solicitudes" element={<Solicitudes/>}/>
      <Route path="/solicitudes/nueva" element={usuario && <Caso key="nuevo" modo="nuevo" usuario={usuario}/>}/>
      <Route path="/solicitudes/:id" element={usuario && <Caso key="detalle" modo="detalle" usuario={usuario}/>}/>
      <Route path="/solicitudes/:id/editar" element={usuario && <Caso key="editar" modo="editar" usuario={usuario}/>}/>
      <Route path="/actividad" element={usuario?.rol === "administrador" ? <Actividad/> : <SinAcceso/>}/>
      <Route path="/clima" element={<ClimaVisitas/>}/>
      <Route path="/guia" element={usuario && <Guia usuario={usuario}/>}/>
      <Route path="*" element={<SinAcceso faltante/>}/>
    </Route></Routes>;
}
export default function Sistema() {
  return <BrowserRouter><Aplicacion/></BrowserRouter>;
}
