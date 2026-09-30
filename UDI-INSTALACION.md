# UDI · Recursos Humanos

Activado en Supabase el 17 de septiembre de 2026: rol, tablas, permisos, funciones y actualización de manage-user. Se conservaron 6 cuentas y 4 solicitudes; el directorio UDI contiene 5 personas. Falta publicar los archivos en GitHub Pages y crear la cuenta UDI. BioTime no está conectado.

## Instalación (pasos 1–3 ya completados en Supabase)

1. En Supabase SQL Editor, ejecutar `udi-01-rol.sql` **por separado** y esperar a que finalice.
2. Ejecutar después `udi-02-estructura.sql`. Se incorporan los colaboradores y administradores existentes, conservando cuentas y vacaciones. Los horarios comienzan en **Por asignar**.
3. Actualizar la función `manage-user` en Supabase con `supabase-functions-manage-user.ts`. Es necesario para que acepte el nuevo rol UDI.
4. Subir a GitHub Pages estos archivos, manteniendo los demás archivos del portal:
   - `vacaciones-aprobaciones.html`
   - `vacaciones.js`
   - `supabase-cloud.js`
   - `udi.js`
   - `udi.css`
5. Desde el superusuario, pulsar **Preparar cuenta UDI**. Se llenan nombre UDI, correo `claudia.quiroga@cedhnl.org.mx` y rol UDI. Definir una contraseña de al menos ocho caracteres y pulsar **Crear usuario**. Si ese correo ya tiene una cuenta, no crear otra: revisar su perfil y asignar el rol UDI desde Supabase. Nunca cambiar un superusuario sin verificarlo antes.
6. Entrar con la cuenta UDI y verificar el directorio, asignar un horario y comprobar que se conserva al cerrar y abrir la sesión.

Los SQL y el archivo de la función son para Supabase, no son archivos necesarios para servir la página.

## Incluido

- Perfil UDI independiente; el superusuario también puede consultar y administrar este módulo.
- Directorio paginado de 20 personas, búsqueda por nombre/ID BioTime, áreas con contador y filtro de horario.
- Alta manual de personal sin crear cuentas de acceso; alta de áreas y movimiento de personas entre áreas.
- Horarios 08:00–16:00, 09:00–17:00, 10:00–18:00, flexible de 8 horas, sin horario/excepción y por asignar.
- Personal por área, distribución de horarios, días-persona aprobados y solicitudes pendientes por rango de fechas.
- Auditoría de los cambios efectuados desde UDI en `udi_changes`.
- Reporte deshabilitado y estado explícito de BioTime pendiente.

Mover un colaborador vinculado también actualiza su área en el portal para nuevas solicitudes. Las solicitudes existentes conservan su área original. El límite existente de un administrador por área sigue aplicándose.

## Pendiente de BioTime

Confirmar versión, identificador estable de persona, zona horaria del servidor y forma de acceso. El campo ID BioTime es texto y único para preservar ceros iniciales y evitar enlaces duplicados. Es opcional mientras llega la base de datos. Todavía no se importa ni sincroniza personal desde BioTime.

Los indicadores de asistencia no se calculan todavía. Falta definir días laborables, descansos, tolerancias y reglas de acumulación para horario flexible. Los cambios de horario tienen auditoría, pero aún no hay una planificación de vigencias para evaluar asistencia histórica.

El dashboard cuenta personas activas del registro, no un total estimado de 120. Vacaciones considera personas vinculadas al portal, el área actual seleccionada y días solicitados dentro del rango. No inventa asistencia ni vacaciones para registros manuales.

## Validación

Verificado en la base real: alta manual, edición de horario, auditoría y bloqueo de lectura/escritura para colaboradores. Las pruebas se ejecutaron dentro de transacciones revertidas, sin dejar personas de prueba. manage-user fue desplegada y respondió a una prueba sin modificación de usuarios. Falta la prueba de ingreso con una cuenta UDI real.

Referencia de permisos: [documentación oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
