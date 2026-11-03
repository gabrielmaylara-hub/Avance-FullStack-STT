import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
const base=process.env.TEST_URL||"http://127.0.0.1:8787";
const config=Object.fromEntries(readFileSync(".dev.vars","utf8").trim().split(/\r?\n/).map(l=>{const i=l.indexOf("=");return[l.slice(0,i),l.slice(i+1)]}));
async function req(path,{method="GET",data,cookie,origin}={}){
 const response=await fetch(base+"/api"+path,{method,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},...(data?{body:JSON.stringify(data)}:{})});
 const raw=await response.text();let parsed;try{parsed=JSON.parse(raw)}catch{parsed={error:raw}}
 return{status:response.status,data:parsed,cookie:response.headers.get("set-cookie")};
}
const login=usuario=>req("/auth/login",{method:"POST",data:{usuario,password:config.DEMO_PASSWORD}});
test("Integración de API REST, base de datos y JWT",async t=>{
 let admin,tech,item,expiredCookie;
 const sample={cliente:"CLI-990001",titulo:"[Prueba automatizada] Diagnóstico",descripcion:"Solicitud ficticia para comprobar el recorrido completo del sistema.",categoria:"Soporte",prioridad:"Alta",estado:"Pendiente"};
 await t.test("01 salud y conexión de base de datos",async()=>{const r=await req("/salud");assert.equal(r.status,200);assert.equal(r.data.baseDeDatos,"conectada")});
 await t.test("02 ruta protegida sin sesión devuelve 401",async()=>assert.equal((await req("/solicitudes")).status,401));
 await t.test("03 contraseña incorrecta devuelve 401",async()=>assert.equal((await req("/auth/login",{method:"POST",data:{usuario:"admin@stt.test",password:"incorrecta"}})).status,401));
 await t.test("04 login de administrador y cookie HttpOnly",async()=>{const r=await login("admin@stt.test");assert.equal(r.status,200);assert.match(r.cookie,/HttpOnly/);assert.match(r.cookie,/SameSite=Strict/);assert.equal(r.data.usuario.rol,"administrador");assert.ok(!("password_hash"in r.data.usuario));admin=r.cookie.split(";")[0]});
 await t.test("05 alta por POST con persistencia",async()=>{const r=await req("/solicitudes",{method:"POST",data:sample,cookie:admin});assert.equal(r.status,201);item=r.data.solicitud;assert.match(item.folio,/^STT-\d{4,}$/);assert.equal(item.version,1)});
 await t.test("06 consulta de registro por identificador",async()=>{const r=await req(`/solicitudes/${item.id}`,{cookie:admin});assert.equal(r.status,200);assert.equal(r.data.solicitud.titulo,sample.titulo)});
 await t.test("07 búsqueda por folio",async()=>{const r=await req(`/solicitudes?q=${item.folio}`,{cookie:admin});assert.equal(r.data.solicitudes.length,1);assert.equal(r.data.solicitudes[0].id,item.id)});
 await t.test("08 modificación mediante PUT y nueva lectura",async()=>{const r=await req(`/solicitudes/${item.id}`,{method:"PUT",data:{...item,estado:"En proceso"},cookie:admin});assert.equal(r.status,200);item=r.data.solicitud;assert.equal(item.version,2);assert.equal((await req(`/solicitudes/${item.id}`,{cookie:admin})).data.solicitud.estado,"En proceso")});
 await t.test("09 edición sobre versión desactualizada devuelve 409",async()=>assert.equal((await req(`/solicitudes/${item.id}`,{method:"PUT",data:{...item,version:1},cookie:admin})).status,409));
 await t.test("10 validación del servidor rechaza título vacío",async()=>assert.equal((await req("/solicitudes",{method:"POST",data:{...sample,titulo:"   "},cookie:admin})).status,400));
 await t.test("11 consulta inexistente e intento SQL tratados como texto",async()=>{assert.equal((await req("/solicitudes/999999999",{cookie:admin})).status,404);assert.equal((await req("/solicitudes?q="+encodeURIComponent("' OR 1=1 --"),{cookie:admin})).data.solicitudes.length,0)});
 await t.test("12 login técnico",async()=>{const r=await login("tecnico@stt.test");assert.equal(r.status,200);assert.equal(r.data.usuario.rol,"tecnico");tech=r.cookie.split(";")[0]});
 await t.test("13 técnico puede actualizar",async()=>{const r=await req(`/solicitudes/${item.id}`,{method:"PUT",data:{...item,estado:"Resuelta"},cookie:tech});assert.equal(r.status,200);item=r.data.solicitud});
 await t.test("14 técnico no puede eliminar ni mediante API directa",async()=>assert.equal((await req(`/solicitudes/${item.id}`,{method:"DELETE",data:{version:item.version},cookie:tech})).status,403));
 await t.test("15 origen externo rechazado",async()=>assert.equal((await req("/solicitudes",{method:"POST",data:sample,cookie:admin,origin:"https://otro-origen.test"})).status,403));
 await t.test("16 JWT manipulado rechazado",async()=>assert.equal((await req("/auth/me",{cookie:"stt_session=eyJhbGciOiJub25lIn0.e30.firma"})).status,401));
 await t.test("17 JWT firmado pero vencido rechazado",async()=>{const token=admin.slice(12),[h,p]=token.split("."),claims=JSON.parse(Buffer.from(p,"base64url").toString());claims.iat=Math.floor(Date.now()/1000)-7200;claims.exp=claims.iat+3600;const data=h+"."+Buffer.from(JSON.stringify(claims)).toString("base64url");expiredCookie="stt_session="+data+"."+createHmac("sha256",config.JWT_SECRET).update(data).digest("base64url");assert.equal((await req("/auth/me",{cookie:expiredCookie})).status,401)});
 await t.test("18 cierre de sesión revoca incluso la cookie anterior",async()=>{assert.equal((await req("/auth/logout",{method:"POST",data:{},cookie:tech})).status,200);assert.equal((await req("/auth/me",{cookie:tech})).status,401)});
 await t.test("19 administrador elimina mediante DELETE",async()=>assert.equal((await req(`/solicitudes/${item.id}`,{method:"DELETE",data:{version:item.version},cookie:admin})).status,200));
 await t.test("20 eliminación confirmada y actividad conservada",async()=>{assert.equal((await req(`/solicitudes/${item.id}`,{cookie:admin})).status,404);const r=await req("/actividad",{cookie:admin});const events=r.data.actividad.filter(e=>e.solicitud_id===item.id);assert.deepEqual(events.map(e=>e.accion),["Eliminación","Actualización","Actualización","Creación"])});
 await t.test("21 filtros por estado y categoría",async()=>{const r=await req("/solicitudes?estado=Resuelta&categoria=Redes",{cookie:admin});assert.equal(r.status,200);assert.ok(r.data.solicitudes.every(s=>s.estado==="Resuelta"&&s.categoria==="Redes"))});
 await t.test("22 cierre de sesión de administrador",async()=>assert.equal((await req("/auth/logout",{method:"POST",data:{},cookie:admin})).status,200));
});
