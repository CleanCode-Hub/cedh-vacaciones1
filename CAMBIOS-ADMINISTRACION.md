Actualización del portal — 28 de septiembre de 2026

Cambios realizados directamente en el proyecto existente y en portal-ordenado:
C:\Users\CEDH\Documents\Codex\2026-09-10\aho\outputs

Administrador
- En Registro de mi área, cada solicitud futura pendiente o aprobada tiene Cancelar vacaciones.
- Las solicitudes con cancelación pendiente tienen Autorizar cancelación.
- Se exige motivo y confirmación. La cancelación conserva la solicitud, fechas, aprobación previa y datos del colaborador que pidió cancelarla.
- Se guarda administrador, fecha y motivo de resolución. Los días cancelados dejan de descontar saldo.
- No se permite actuar fuera del área ni cancelar vacaciones iniciadas, terminadas, rechazadas o ya canceladas.

Superusuario
- En Áreas aparece Quitar área, con confirmación.
- La base de datos rechaza eliminar áreas con usuarios activos o desactivados, personal de RH o historial de vacaciones. No se eliminan usuarios ni historial para quitar el área.

Contraseñas
- Mostrar/Ocultar permanente en acceso, nueva contraseña, confirmación y creación de usuario.
- Los campos vuelven a ocultarse al enviar, restablecer formularios, salir o cambiar de pestaña.

Estado
Las funciones admin_cancel_vacation_request y remove_empty_area quedaron instaladas en Supabase. No se cambió el servidor ni el alojamiento. Los archivos web están actualizados localmente; este trabajo no los publicó en el sitio alojado.
Esta actualización sustituye la indicación anterior de que faltaba la autorización del administrador. No añade autorización al rol UDI/RH.

Pruebas
- 38 comprobaciones del colaborador y 24 administrativas.
- Regresión de cálculos y contenido no modificado de las cuatro vistas.
- Pruebas reales de Supabase en transacción revertida: cancelación directa, autorización preservando motivo original, motivo obligatorio, bloqueo por fecha y área, roles, usuarios, historial y área vacía.
- Navegador: mostrar/ocultar contraseña y presencia del control en los cuatro campos.
- Ninguna solicitud ni área existente fue cancelada/eliminada durante las pruebas.

Archivos nuevos: gestion.js, contrasenas.js, admin-areas.sql.
Archivos modificados: portal.js, acceso.js, portal.css, vacaciones-aprobaciones.html.
Respaldo previo: work/respaldo-admin-areas de esta tarea.
