# Publicar el Portal de vacaciones CEDH

Esta carpeta (`outputs`) ya contiene el sitio listo para GitHub Pages. La base de datos y la seguridad están en Supabase; no hay contraseñas dentro de estos archivos.

## Qué subir

Sube **todo el contenido de esta carpeta**, conservando los nombres de los archivos. El archivo `index.html` abre automáticamente el portal.

No publiques ni compartas fuera del equipo:

- `supabase-schema.sql` (es respaldo de la estructura de la base de datos).
- `supabase-functions-manage-user.ts` (es respaldo de la función segura ya publicada en Supabase).

Puedes conservar ambos archivos en esta carpeta local como respaldo. Si deseas un repositorio que solo contenga la página, omítelos al subir a GitHub.

## En GitHub Pages

1. Crea un repositorio privado u organizacional para el portal.
2. Sube los archivos de esta carpeta al nivel principal del repositorio.
3. En **Settings > Pages**, selecciona **Deploy from a branch**.
4. Elige la rama `main` y la carpeta `/(root)`.
5. Guarda. GitHub mostrará la dirección pública del portal en unos minutos.

## Después de publicar

En Supabase, agrega la dirección final de GitHub Pages en la configuración de autenticación, dentro de **URL Configuration > Redirect URLs**. Así las sesiones del portal quedan autorizadas para esa página.
