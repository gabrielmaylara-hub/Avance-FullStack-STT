export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415, "Envía los datos como JSON.");
  const raw = await request.text();
  if (raw.length > 8000) throw new ApiError(413, "La solicitud es demasiado extensa.");
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ApiError(400, "El contenido JSON no es válido."); }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "El origen de la solicitud no está permitido.");
}
export function folio(id: number) { return `STT-${String(id).padStart(4, "0")}`; }

// Consume la entrada antes de responder, incluso si después se rechazan los permisos.
// Evita dejar cuerpos pendientes en conexiones HTTP reutilizadas del servidor local.
export async function bufferedRequest(request: Request) {
  if (!request.body || ["GET","HEAD"].includes(request.method)) return request;
  const reader=request.body.getReader(), chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
    if(length>8000){await reader.cancel();throw new ApiError(413,"La solicitud es demasiado extensa.");}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new Request(request,{body:bytes});
}
