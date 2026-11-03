import {readFileSync} from "node:fs";
const base=process.env.TEST_URL||"http://127.0.0.1:8787";
const vars=Object.fromEntries(readFileSync(".dev.vars","utf8").trim().split(/\r?\n/).map(l=>{const i=l.indexOf("=");return[l.slice(0,i),l.slice(i+1)]}));
const login=await fetch(base+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({usuario:"admin@stt.test",password:vars.DEMO_PASSWORD})});
if(!login.ok)throw new Error("No fue posible iniciar sesión. Comprueba que npm start está abierto.");
const cookie=login.headers.get("set-cookie").split(";")[0];
const headers={"Content-Type":"application/json",Cookie:cookie};
const existing=(await(await fetch(base+"/api/solicitudes",{headers})).json()).solicitudes;
const data=[
 {cliente:"CLI-001",titulo:"Mantenimiento preventivo de computadora",descripcion:"Limpieza física y revisión de ventilación de una computadora de oficina.",categoria:"Mantenimiento",prioridad:"Baja",estado:"Pendiente"},
 {cliente:"CLI-002",titulo:"Sin conexión en la red de oficina",descripcion:"La oficina reporta pérdida de conectividad en tres equipos de su red local.",categoria:"Redes",prioridad:"Crítica",estado:"En proceso"},
 {cliente:"CLI-003",titulo:"Diagnóstico de equipo con arranque lento",descripcion:"Revisar el arranque y las aplicaciones de una computadora que presenta lentitud.",categoria:"Soporte",prioridad:"Media",estado:"Pendiente"},
 {cliente:"CLI-004",titulo:"Configuración de router inalámbrico",descripcion:"Configurar la red inalámbrica y comprobar la conexión de los dispositivos.",categoria:"Redes",prioridad:"Media",estado:"Resuelta"},
 {cliente:"CLI-005",titulo:"Falla de encendido en equipo de ventas",descripcion:"Diagnosticar la falla de encendido de una computadora del área de ventas.",categoria:"Soporte",prioridad:"Alta",estado:"Pendiente"},
 {cliente:"CLI-006",titulo:"Revisión de temperatura y ventilación",descripcion:"Comprobar las temperaturas y la ventilación del equipo después del mantenimiento.",categoria:"Mantenimiento",prioridad:"Baja",estado:"Resuelta"},
];
let added=0;
for(const item of data){if(existing.some(e=>e.titulo===item.titulo&&e.cliente===item.cliente))continue;const r=await fetch(base+"/api/solicitudes",{method:"POST",headers,body:JSON.stringify(item)});if(!r.ok)throw new Error(await r.text());added++;}
await fetch(base+"/api/auth/logout",{method:"POST",headers,body:"{}"});
console.log(`${added} solicitudes agregadas. No se duplican al ejecutar nuevamente.`);
