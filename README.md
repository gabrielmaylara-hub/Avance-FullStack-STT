# Sistema de solicitudes de soporte · STT

Proyecto final de Desarrollo Full Stack de Gabriel Josué May Lara, matrícula 07229881. La aplicación continúa el avance de **Soluciones Tecnológicas de Tabasco**. Permite registrar solicitudes, asignar prioridad, actualizar su estado y revisar el historial de atención. El módulo de clima apoya la programación de visitas en Villahermosa. Los casos y cuentas son ficticios.

## Ejecución local

Instala Node.js 22.13 o posterior. En la carpeta que contiene `package.json`, ejecuta:

```sh
npm ci
npm run preparar
npm run build
npm start
```

Abre **http://127.0.0.1:3000**. Las cuentas son `admin@stt.test` y `tecnico@stt.test`. Al preparar una instalación desde el ZIP se toman las dos contraseñas de `Acceso.txt`. Un clon independiente genera contraseñas en el archivo local `.env`. El secreto de firma se crea de forma independiente en cada instalación. Una segunda ejecución conserva el archivo existente.

Para el modo local se usa PGlite, una distribución embebida de PostgreSQL que guarda los datos en `data/stt`. Para usar un servidor PostgreSQL, agrega `DATABASE_URL` a `.env` con la cadena de tu base dedicada. La primera ejecución crea tablas, cuentas y solicitudes de muestra de forma transaccional. La siembra conserva cambios y eliminaciones en reinicios posteriores.

## Operación y permisos

| Función | Técnico | Administrador |
| --- | --- | --- |
| Consultar, filtrar y paginar solicitudes | Sí | Sí |
| Registrar, abrir y modificar casos | Sí | Sí |
| Consultar el clima de Villahermosa y el resumen | Sí | Sí |
| Consultar actividad y eliminar solicitudes | — | Sí |

React Router resuelve el detalle por `/solicitudes/:id` y la edición por `/solicitudes/:id/editar`. El servidor entrega la misma aplicación al recargar un enlace de detalle. La interfaz recupera la sesión con `GET /api/auth/me`; la cookie HttpOnly contiene un JWT y el servidor verifica que la sesión continúe vigente.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `frontend/` | Interfaz React, cliente HTTP, navegación y estilos responsivos. |
| `backend/app.js`, `server.js` | Rutas Express y arranque del servidor. |
| `backend/auth.js`, `validation.js`, `errors.js` | Sesiones, permisos, validación y respuestas de error. |
| `backend/schema.sql`, `demo.sql`, `db.js` | Persistencia, datos de muestra y transacciones. |
| `backend/weather.js` | Consulta a Open-Meteo y validación de su respuesta. |
| `tests/`, `postman/` | Suite automatizada y colección para recorrer la API. |
| `render.yaml` | Configuración de producción con un servicio Node y PostgreSQL. |

## API

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | /api/salud | Verificar que el servidor pueda consultar la base. |
| POST | /api/auth/login | Iniciar sesión con usuario y password. |
| GET | /api/auth/me | Consultar la cuenta y el rol actual. |
| POST | /api/auth/logout | Revocar la sesión. |
| GET | /api/solicitudes | Consultar por q, estado, categoria, prioridad, pagina y limite. |
| POST | /api/solicitudes | Crear un caso y devolver su folio. |
| GET | /api/solicitudes/:id | Abrir el detalle. |
| PUT | /api/solicitudes/:id | Guardar los campos y la versión leída. |
| DELETE | /api/solicitudes/:id | Eliminar como administrador indicando la versión leída. |
| GET | /api/resumen | Consultar contadores generales. |
| GET | /api/actividad | Consultar los movimientos recientes como administrador. |
| GET | /api/clima | Obtener las condiciones del tiempo para la visita. |

Ejemplo: `GET /api/solicitudes?estado=Pendiente&pagina=1&limite=5`. El resultado incluye `solicitudes` y `paginacion` (página, límite, total y total de páginas). Un caso se captura con `cliente`, `titulo`, `descripcion`, `categoria`, `prioridad` y `estado`. La edición y la eliminación requieren el último valor de `version`. Ante un conflicto se devuelve HTTP 409.

La consulta de clima usa `fetch` desde Express a la API pública de Open-Meteo. Envía las coordenadas de Villahermosa y solicita temperatura, sensación térmica, precipitación y código meteorológico. Verifica la lectura, unidades y zona horaria. La caché de diez minutos evita repetir consultas simultáneas. Si el proveedor rechaza la consulta o tarda más de ocho segundos, el usuario puede reintentar desde la pantalla de clima.

## Pruebas y depuración

```sh
npm test
npm run check
npm run debug
```

El inspector escucha en 127.0.0.1:9229. Se puede adjuntar un depurador de Node o Chrome DevTools para observar las validaciones. Con `NODE_DEBUG=stt` el middleware registra método, ruta y estado de errores.

En Postman importa los dos JSON de `postman/` y selecciona **STT local**. Configura `baseUrl`, `adminPassword` y `techPassword` con los valores de la instalación. Ejecuta la colección en orden y habilita el manejo de cookies. El recorrido crea un caso propio y lo elimina al finalizar. La lectura meteorológica requiere conexión a Open-Meteo.

## Despliegue en Render

La rama `entrega-final` contiene `render.yaml`. En Render, crea un Blueprint desde esta rama, selecciona los planes gratuitos indicados y captura `ADMIN_PASSWORD` y `TECH_PASSWORD` como variables privadas. Render genera `JWT_SECRET` y enlaza `DATABASE_URL` con PostgreSQL. El servicio ejecuta `npm ci --include=dev && npm run build` y después `npm start`. Comprueba `/api/salud` y ambos accesos en la URL que asigne Render.

[Configurar el Blueprint en Render](https://render.com/deploy?repo=https://github.com/gabrielmaylara-hub/Avance-FullStack-STT/tree/entrega-final) · [Documentación de Open-Meteo](https://open-meteo.com/en/docs)
