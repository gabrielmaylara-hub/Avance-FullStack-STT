import { ApiError,json,sameOrigin,bufferedRequest } from "./lib/http";
import { authenticate,type AppEnv } from "./middleware/auth";
import * as auth from "./controllers/authController";
import * as s from "./controllers/solicitudesController";
export async function route(request: Request,env: AppEnv) {
  try {
    request=await bufferedRequest(request);
    const path=new URL(request.url).pathname.replace(/\/$/,""), m=request.method;
    if (!["GET","HEAD","OPTIONS"].includes(m)) sameOrigin(request);
    if (!env.DB) throw new ApiError(503,"La base de datos no está configurada.");
    if(path==="/api/salud"&&m==="GET") { await env.DB.prepare("SELECT 1 AS ok").first(); return json({estado:"ok",baseDeDatos:"conectada",aplicacion:"STT Soporte"}); }
    if(path==="/api/auth/login"&&m==="POST") return await auth.login(request,env);
    const session=await authenticate(request,env);
    if(path==="/api/auth/me"&&m==="GET") return json({usuario:session.user});
    if(path==="/api/auth/logout"&&m==="POST") return await auth.logout(request,env,session.sessionId);
    if(path==="/api/resumen"&&m==="GET") return await s.summary(env);
    if(path==="/api/actividad"&&m==="GET") return await s.history(env);
    if(path==="/api/solicitudes"&&m==="GET") return await s.list(request,env);
    if(path==="/api/solicitudes"&&m==="POST") return await s.create(request,env,session.user);
    const match=path.match(/^\/api\/solicitudes\/([1-9]\d*)$/);
    if(match&&Number.isSafeInteger(Number(match[1]))) {
      const id=Number(match[1]);
      if(m==="GET") return await s.detail(env,id);
      if(m==="PUT") return await s.update(request,env,session.user,id);
      if(m==="DELETE") return await s.remove(request,env,session.user,id);
    }
    throw new ApiError(404,"La ruta solicitada no existe.");
  } catch(error) {
    if(error instanceof ApiError) return json({error:error.message},error.status);
    console.error("Error interno de API",error instanceof Error?error.message:"desconocido");
    return json({error:"No fue posible completar la operación. Intenta de nuevo."},500);
  }
}
