# Avance del proyecto Full Stack

**Soluciones Tecnológicas de Tabasco**  
**Alumno:** Lic. Gabriel Josué May Lara · **Matrícula:** 07229881  
**Docente:** Mtro. Carlos Arturo Sánchez Rivera · **Materia:** Desarrollo Full Stack

Aplicación académica para administrar solicitudes ficticias de mantenimiento, soporte y redes. Integra operaciones CRUD, autenticación JWT, permisos por rol, historial de actividad y una base de datos D1 persistente. El frontend utiliza React, TypeScript y CSS; el backend se ejecuta en Cloudflare Workers. El código se conserva en GitHub y la aplicación se publica directamente en Cloudflare.

**Aplicación publicada:** [Abrir el sistema STT](https://stt-avance-07229881.gabrielmaylara-07229881.workers.dev). El enlace presenta el inicio de sesión del sistema; las cuentas ficticias de evaluación se incluyen en la entrega académica. No se necesita una cuenta de Cloudflare para utilizarlo.

## Ejecución local

Requisitos: Node.js 22.13 o posterior y npm. Desde la carpeta del proyecto:

```text
npm ci
npm run preparar
npm run check
npm run build
npm run db:local
npm start
```

Abre http://127.0.0.1:8787. Mantén abierto el servidor. En otra consola, `npm run datos:demo` agrega seis solicitudes ficticias sin duplicarlas. Los datos locales se conservan en `.wrangler/state`; no se pierden al cerrar el navegador.

`preparar` crea `.dev.vars` con una clave JWT y una contraseña aleatoria para esta copia. Muestra la contraseña inicial en la consola. No sobrescribe una configuración que ya existe. El archivo de ejemplo `.dev.vars.example` documenta las variables y no contiene claves de producción.

| Cuenta ficticia | Permisos |
| --- | --- |
| admin@stt.test | Consultar, crear, modificar, eliminar y ver actividad |
| tecnico@stt.test | Consultar, crear, modificar y ver actividad |

Ambas cuentas utilizan la contraseña inicial configurada en `DEMO_PASSWORD`. Se crean cuando se inicia sesión por primera vez. Solo se permiten clientes ficticios como CLI-001. No deben capturarse datos personales o de clientes reales.

## Organización

| Carpeta o archivo | Responsabilidad |
| --- | --- |
| frontend | Interfaz React, formularios, filtros y estilos |
| backend/controllers | Controladores de autenticación y CRUD |
| backend/middleware | Validación de sesión y permisos |
| backend/models | Modelo de solicitud y validaciones |
| backend/lib y backend/router.ts | JWT, contraseñas, respuestas y rutas REST |
| worker/index.ts | Entrada del servidor y conexión con los archivos del frontend |
| migrations | Esquema SQL y migraciones de D1 |
| scripts | Preparación y datos ficticios |
| wrangler.jsonc | Configuración de Cloudflare y enlace de la base DB |

El frontend envía peticiones Fetch al backend del mismo dominio. El servidor verifica la cookie JWT y el rol de la cuenta antes de ejecutar sentencias SQL con parámetros. Los cambios se agrupan con su registro de actividad mediante transacciones por lote de D1. Las fechas se guardan en ISO UTC y se muestran en horario de Ciudad de México.

## API REST

| Método | Ruta | Operación |
| --- | --- | --- |
| GET | /api/salud | Comprobar el servidor y la conexión |
| POST | /api/auth/login | Iniciar sesión |
| GET | /api/auth/me | Consultar la cuenta actual |
| POST | /api/auth/logout | Revocar la sesión |
| GET | /api/solicitudes | Listar o buscar por q, estado y categoria |
| POST | /api/solicitudes | Crear una solicitud |
| GET | /api/solicitudes/:id | Consultar el detalle |
| PUT | /api/solicitudes/:id | Modificar con la versión vigente |
| DELETE | /api/solicitudes/:id | Eliminar con la versión vigente, solo administrador |
| GET | /api/resumen | Obtener contadores |
| GET | /api/actividad | Obtener las últimas 50 acciones |

Una solicitud contiene cliente, título, descripción, categoría, prioridad y estado. El servidor genera su ID, folio, fechas y versión. PUT recibe todos los campos y `version`; DELETE recibe `{ "version": 1 }` con la versión vigente. El listado tiene un máximo de 500 registros por consulta, ordenados del más reciente al más antiguo. Una edición desactualizada devuelve 409.

## Seguridad y validaciones

JWT HS256 firmado mediante Web Crypto con vigencia de una hora. Se verifican firma, algoritmo, emisor, audiencia, sujeto, vencimiento y sesión registrada. La cookie es HttpOnly, SameSite Strict y Secure sobre HTTPS. El token no se guarda en localStorage ni se devuelve en el JSON de acceso. Al salir se revoca la sesión en la base de datos.

Las contraseñas se derivan mediante PBKDF2 SHA-256 con 100000 iteraciones y una sal aleatoria por cuenta. Las mutaciones requieren JSON, limitan el tamaño de la entrada y rechazan orígenes web diferentes. El backend aplica los permisos incluso ante peticiones enviadas directamente a la API. Cinco errores de contraseña limitan temporalmente el acceso de esa combinación de IP y usuario.

## Publicación directa en Cloudflare

Se necesita una cuenta de Cloudflare con Workers y D1 habilitados. La autorización se realiza con `npm run cloudflare:login`. La base alojada se crea una sola vez y su identificador se coloca en `wrangler.jsonc`. Las migraciones de producción se aplican con `npm run db:remote`.

Las variables `JWT_SECRET` y `DEMO_PASSWORD` se cargan como secretos de Cloudflare. Nunca se guardan sus valores en GitHub. `npm run deploy` verifica, compila y publica la aplicación. El resultado muestra la dirección real bajo workers.dev. No es necesario comprar un dominio. La base local y la de producción son independientes.

## Evidencias de la entrega

El documento Word, las capturas y el video se entregan en la carpeta comprimida académica. La demostración muestra el inicio de sesión, el alta, la consulta, la modificación, la eliminación y la actividad reciente. También incluye las respuestas HTTP obtenidas durante el recorrido del frontend y una vista en móvil. El código del repositorio no incluye contraseñas de producción ni bases de datos con sesiones activas.

## Referencias

- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/workers/static-assets/
- https://datatracker.ietf.org/doc/html/rfc7519
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits
