-- Los seis casos ficticios del avance. La marca de inicialización evita repoblar casos eliminados.
WITH nuevos AS (
  INSERT INTO solicitudes (cliente,titulo,descripcion,categoria,prioridad,estado,creado_por)
  VALUES
    ('CLI-001','Mantenimiento preventivo de computadora','Limpieza física y revisión de ventilación de una computadora de oficina.','Mantenimiento','Baja','Pendiente','demo-admin'),
    ('CLI-002','Sin conexión en la red de oficina','La oficina reporta pérdida de conectividad en tres equipos de su red local.','Redes','Crítica','En proceso','demo-admin'),
    ('CLI-003','Diagnóstico de equipo con arranque lento','Revisar el arranque y las aplicaciones de una computadora que presenta lentitud.','Soporte','Media','Pendiente','demo-admin'),
    ('CLI-004','Configuración de router inalámbrico','Configurar la red inalámbrica y comprobar la conexión de los dispositivos.','Redes','Media','Resuelta','demo-admin'),
    ('CLI-005','Falla de encendido en equipo de ventas','Diagnosticar la falla de encendido de una computadora del área de ventas.','Soporte','Alta','Pendiente','demo-admin'),
    ('CLI-006','Revisión de temperatura y ventilación','Comprobar las temperaturas y la ventilación del equipo después del mantenimiento.','Mantenimiento','Baja','Resuelta','demo-admin')
  RETURNING id, titulo, creado_por
)
INSERT INTO actividad (solicitud_id,usuario_id,accion,detalle) SELECT id,creado_por,'Creación',titulo FROM nuevos;
