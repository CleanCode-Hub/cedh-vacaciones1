Estadísticas de vacaciones — actualización del 28/09/2026

Acceso
- Superusuario: pestaña Estadísticas en el panel de administración.
- UDI: botón Estadísticas junto a Dashboard y Personas por área.
- Desde Recursos Humanos del superusuario, Estadísticas abre la misma pestaña principal.

Indicadores
Solicitudes, personas con solicitudes, pendientes, aprobadas, cancelaciones pendientes, canceladas, rechazadas, días en solicitudes, días-persona vigentes, días en cancelaciones y porcentaje de canceladas entre las solicitudes filtradas.
Incluye gráfico semanal/mensual y tabla comparativa por área.

Filtros
Área, estado, esta semana, semana anterior, este mes, mes anterior, este año y rango personalizado. La tendencia puede agruparse por semana o por mes.
Consultar por permite elegir fechas de vacaciones, fecha de creación de solicitud o fecha de cancelación efectiva.

Interpretación
- Fechas de vacaciones: solo suma días dentro del rango y cuenta una vez cada solicitud que cruza el rango.
- Fecha de solicitud: selecciona solicitudes creadas en el rango y suma todos sus días.
- Fecha de cancelación efectiva: selecciona cancelaciones completadas en el rango, no solicitudes pendientes de cancelación.
- Días-persona vigentes incluye aprobadas y cancelación pendiente. Cada combinación de persona y fecha se cuenta una vez.
- Días en cancelaciones no equivale necesariamente a saldo devuelto: puede incluir peticiones nunca aprobadas.
- Una solicitud puede aparecer en más de una semana/mes si sus días abarcan varios grupos; el total general la cuenta una vez.
- Los estados son los actuales. No se reconstruyen fotografías históricas del estado de las solicitudes.
- Se usa el área registrada en la solicitud y se conserva el historial de personas desactivadas.
- Semanas de lunes a domingo. Zona horaria America/Monterrey.
- Sin registros se muestra cero y porcentaje no disponible. Si falla la carga, no se presentan totales parciales como completos.

Verificación
40 comprobaciones de cálculos, fechas, duplicados, cancelaciones, semanas que cruzan de año, meses bisiestos y carga paginada de más de 1000 solicitudes.
También pasaron las 38 comprobaciones del colaborador, las 24 administrativas y la regresión de las vistas existentes.
Pruebas de navegador con datos ficticios: navegación UDI/superusuario, filtros, vista sin resultados, colaborador sin acceso a Estadísticas y ancho móvil de 390 px sin desbordamiento horizontal.

Instalación
Los archivos del proyecto existente y su carpeta portal-ordenado están actualizados directamente.
Archivo nuevo: estadisticas.js. Modificados: personal.js, portal.css, vacaciones-aprobaciones.html.
No se ejecutaron cambios de base de datos ni se amplió el acceso: se usan las consultas paginadas y políticas de lectura existentes de UDI y superusuario.
No se publicó el sitio alojado. El paquete portal-con-estadisticas.zip contiene el portal completo actualizado, incluidos los cambios anteriores.
Respaldo anterior a esta edición: work/respaldo-estadisticas de esta tarea.
