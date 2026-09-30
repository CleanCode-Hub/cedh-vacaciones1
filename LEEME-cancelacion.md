Cambios realizados directamente en el proyecto existente:
C:\Users\CEDH\Documents\Codex\2026-09-10\aho\outputs
y su carpeta portal-ordenado.

- Pendiente y futura: Cancelar solicitud.
- Aprobada y futura: Solicitar cancelación; conserva los días descontados.
- Iniciada hoy, pasada, rechazada, cancelada o con cancelación pendiente: sin botón.
- Motivo opcional de hasta 1000 caracteres y confirmación antes de enviar.
- Historial conservado; no se borran solicitudes ni días.
- Fecha de referencia: America/Monterrey, consistente con el portal CEDH Nuevo León.

Estado de activación
Los archivos están modificados. NO se ejecutaron cambios en Supabase ni en el servidor.
El esquema local revisado no tiene los estados ni la función de cancelación necesarios.
cancelacion-preparada.sql deja preparada esa ampliación: ejecutar sus dos secciones por separado cuando se autorice su aplicación. No es una migración de alojamiento.
Hasta entonces, el botón informa que la función no está habilitada si el servidor no la tiene; no simula guardados locales.
La autorización final de cancelaciones de vacaciones aprobadas por RH/jefe queda fuera de esta etapa de colaborador y requiere su flujo posterior. No liberar esos días manualmente desde la interfaz.

Verificación
38 comprobaciones automatizadas con servicio simulado: elegibilidad, propietario/rol, fechas, saldo, confirmación, motivo, error de servicio y asistencia.
Regresión de contenido/cálculos de las vistas de colaborador, administrador, superusuario y RH; referencias de archivos y sintaxis JavaScript.
No se probaron escrituras reales ni se ejecutó el SQL contra una base de datos; falta la prueba integral con Supabase una vez habilitado.
Respaldo anterior a la edición conservado en work/respaldo-cancelacion de esta tarea.

Actualización 28/09/2026: HABILITADO en Supabase, proyecto vacaciones-cedh (rwokuykwqkkseomawzps).
Se instalaron los estados cancelled y cancellation_pending, cuatro campos de cancelación y cancel_vacation_request(uuid,text,text). Se verificó ejecución permitida a authenticated y denegada a anon.
Pruebas reales de función en transacción revertida: pendiente -> cancelled; aprobada -> cancellation_pending; rechazo de vacaciones iniciadas; rechazo sin sesión. Resultado PASS. Los datos temporales fueron revertidos.
Esta actualización sustituye las indicaciones anteriores de SQL pendiente. No se modificó el alojamiento ni se publicaron los archivos web.
La autorización final por RH/jefe sigue siendo una etapa posterior.
