# Corrección de acceso — 22 septiembre 2026

Cambios locales, aún no publicados.

- La interfaz oculta Desactivar para la cuenta propia y para todos los superusuarios; el manejador también rechaza esos destinos.
- Se elimina el ingreso con contraseñas del prototipo local y la carga de sus cuentas guardadas.
- Se exige active=true al cargar el portal y al administrar usuarios.
- La sesión abierta vuelve a consultar el perfil cada 15 segundos y al regresar a la ventana. Si no puede validar el acceso, oculta el portal, limpia los datos principales en memoria y cierra la sesión local.
- La migración añade RLS restrictiva a las nueve tablas existentes y protege superusuarios contra eliminación, desactivación y cambio de rol. No modifica el estado actual de las cuentas.
- La función de aprobación rechaza explícitamente perfiles inactivos o ausentes, también cuando el rol devuelve NULL.

## Publicación pendiente

1. Probar primero en una base de pruebas con el esquema del portal y UDI instalado. Ejecutar seguridad-acceso-20260922.sql después de las migraciones anteriores.
2. Verificar con cuentas ficticias: autodesactivación y desactivación de otro superusuario rechazadas; empleado activo conserva acceso; empleado desactivado no puede consultar ni modificar las nueve tablas, ni aprobar por RPC usando un token anterior. Verificar también UDI y un administrador activo.
3. Aplicar la migración en Supabase y publicar supabase-functions-manage-user.ts como manage-user.
4. Subir vacaciones.js, periodos.js, supabase-cloud.js y vacaciones-aprobaciones.html a GitHub Pages.
5. Comprobar en dos navegadores: desactivar un empleado de prueba mientras tiene una sesión abierta. Los datos del servidor deben quedar bloqueados inmediatamente por RLS; la interfaz se retira en la siguiente revisión (15 segundos o al volver a la ventana).

La prohibición de autenticación nueva de una cuenta desactivada sigue dependiendo del ban de Supabase Auth que ejecuta manage-user. Si ese paso falla, el perfil inactivo y RLS siguen bloqueando el portal; la función devuelve error para poder reintentar. Cambiar active manualmente no equivale a aplicar un ban de Auth.

Validación local: sintaxis JavaScript correcta y cinco pruebas de revisión de sesión con respuestas simuladas. La migración SQL y el despliegue no se han ejecutado; no se afirma validación integral en Supabase.

## Aplicado en Supabase — 22 septiembre 2026
Migración aplicada correctamente en vacaciones-cedh y función manage-user publicada con comprobación active !== true. Verificadas nueve políticas restrictivas. Prueba transaccional de autodesactivación rechazada y cuenta Jorge activa con rol superuser. Prueba transaccional de empleado inactivo: sin lectura de las nueve tablas y aprobación RPC rechazada. Ambas pruebas terminaron con ROLLBACK, sin cambios persistentes en cuentas. Pendiente subir los cuatro archivos del portal a GitHub; no se probó login completo de un empleado desactivado en navegador.
