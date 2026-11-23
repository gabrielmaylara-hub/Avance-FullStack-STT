import { Router } from 'express';
import { requireAdmin } from './auth.js';
import { HttpError } from './errors.js';
import { identify, listFilters, validate, validateSolicitud, version } from './validation.js';

function folio(id) {
  return 'STT-' + String(id).padStart(4, '0');
}

function present(row) {
  return { ...row, folio: folio(row.id) };
}

function fields(input) {
  return [input.cliente, input.titulo, input.descripcion, input.categoria, input.prioridad, input.estado];
}

async function logChange(tx, id, userId, action, detail) {
  await tx.query(
    'INSERT INTO actividad (solicitud_id, usuario_id, accion, detalle) VALUES ($1,$2,$3,$4)',
    [id, userId, action, detail],
  );
}

async function missingOrStale(tx, id) {
  const result = await tx.query('SELECT id FROM solicitudes WHERE id = $1', [id]);
  if (!result.rows.length) throw new HttpError(404, 'No se encontró la solicitud.');
  throw new HttpError(409, 'Otra persona cambió esta solicitud. Actualiza la lista antes de continuar.');
}

export function solicitudesRouter(db) {
  const router = Router();
  router.get('/solicitudes', validate('query', listFilters), async (req, res) => {
    const { q, estado, categoria, prioridad, pagina, limite } = req.input;
    // Una sola instantánea para el conteo y la página, incluso si hay altas simultáneas.
    const { rows } = await db.query(
      `WITH coincidencias AS (
         SELECT * FROM solicitudes
         WHERE ($1 = '' OR strpos(lower(titulo), lower($1)) > 0
                OR strpos(lower(cliente), lower($1)) > 0
                OR strpos('stt-' || lpad(id::text, greatest(4, length(id::text)), '0'), lower($1)) > 0)
           AND ($2 = '' OR estado = $2) AND ($3 = '' OR categoria = $3) AND ($4 = '' OR prioridad = $4)
       ), pagina AS (SELECT * FROM coincidencias ORDER BY id DESC LIMIT $5 OFFSET $6)
       SELECT (SELECT count(*)::int FROM coincidencias) AS total,
              COALESCE((SELECT json_agg(p ORDER BY p.id DESC) FROM pagina p), '[]'::json) AS solicitudes`,
      [q, estado, categoria, prioridad, limite, (pagina - 1) * limite],
    );
    const { total, solicitudes } = rows[0];
    res.json({ solicitudes: solicitudes.map(present), paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) } });
  });

  router.get('/resumen', async (_req, res) => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS total,
       (count(*) FILTER (WHERE estado = 'Pendiente'))::int AS pendientes,
       (count(*) FILTER (WHERE estado = 'En proceso'))::int AS proceso,
       (count(*) FILTER (WHERE estado = 'Resuelta'))::int AS resueltas,
       (count(*) FILTER (WHERE prioridad IN ('Alta','Crítica') AND estado <> 'Resuelta'))::int AS prioritarias FROM solicitudes`,
    );
    res.json({ resumen: rows[0] });
  });

  router.get('/actividad', requireAdmin, async (_req, res) => {
    const { rows } = await db.query(
      'SELECT a.*, u.nombre FROM actividad a JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.id DESC LIMIT 50',
    );
    res.json({ actividad: rows.map(row => ({ ...row, folio: folio(row.solicitud_id) })) });
  });

  router.get('/solicitudes/:id', identify, async (req, res) => {
    const { rows } = await db.query('SELECT * FROM solicitudes WHERE id = $1', [req.solicitudId]);
    if (!rows.length) throw new HttpError(404, 'No se encontró la solicitud.');
    res.json({ solicitud: present(rows[0]) });
  });

  router.post('/solicitudes', validate('body', validateSolicitud), async (req, res) => {
    const solicitud = await db.transaction(async tx => {
      const { rows } = await tx.query(
        `INSERT INTO solicitudes (cliente,titulo,descripcion,categoria,prioridad,estado,creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [...fields(req.input), req.user.id],
      );
      await logChange(tx, rows[0].id, req.user.id, 'Creación', rows[0].titulo);
      return present(rows[0]);
    });
    res.status(201).json({ solicitud, mensaje: 'Solicitud registrada.' });
  });

  router.put('/solicitudes/:id', identify, validate('body', data => ({ ...validateSolicitud(data), version: version(data) })), async (req, res) => {
    const solicitud = await db.transaction(async tx => {
      const { rows } = await tx.query(
        `UPDATE solicitudes SET cliente=$1, titulo=$2, descripcion=$3, categoria=$4, prioridad=$5, estado=$6,
         actualizado=now(), version=version+1 WHERE id=$7 AND version=$8 RETURNING *`,
        [...fields(req.input), req.solicitudId, req.input.version],
      );
      if (!rows.length) await missingOrStale(tx, req.solicitudId);
      await logChange(tx, req.solicitudId, req.user.id, 'Actualización', `${rows[0].titulo} · ${rows[0].estado}`);
      return present(rows[0]);
    });
    res.json({ solicitud, mensaje: 'Cambios guardados.' });
  });

  router.delete('/solicitudes/:id', requireAdmin, identify, validate('body', version), async (req, res) => {
    await db.transaction(async tx => {
      const { rows } = await tx.query('DELETE FROM solicitudes WHERE id = $1 AND version = $2 RETURNING id', [req.solicitudId, req.input]);
      if (!rows.length) await missingOrStale(tx, req.solicitudId);
      await logChange(tx, req.solicitudId, req.user.id, 'Eliminación', `Solicitud ${folio(req.solicitudId)} eliminada`);
    });
    res.json({ mensaje: 'Solicitud eliminada.' });
  });
  return router;
}
