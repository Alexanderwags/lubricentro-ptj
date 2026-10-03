# Lubricentro PTJ

Sitio público y panel administrativo hechos con HTML, Tailwind CSS y JavaScript. La administradora inicia sesión con correo y contraseña, registra vehículos y registra cada cambio de aceite, filtro de aceite y filtro de aire. Las personas pueden consultar el último servicio por patente sin ver el nombre ni el teléfono del cliente.

## Estado de esta instalación

El proyecto Supabase `gnhmjylraepiszcnwxdd` ya está conectado en `config.js`. El esquema de `supabase/schema.sql` se aplicó y se comprobó que las tablas tienen RLS y que los visitantes no pueden insertar vehículos. Aún falta crear la cuenta de Auth de la administradora y vincular su UUID en `admin_users`.

## Configuración

1. Crea un proyecto de Supabase. En **SQL Editor**, ejecuta [`supabase/schema.sql`](supabase/schema.sql) una sola vez.
2. En **Authentication → Users**, crea la cuenta de la administradora con su correo y una contraseña privada. Desactiva el registro público de usuarios en los ajustes de autenticación si no lo necesitas.
3. Copia el UUID de esa cuenta y ejecuta en SQL Editor: `insert into public.admin_users (id) values ('UUID-DE-LA-ADMINISTRADORA');`
4. En **Project Settings → API Keys**, copia la URL del proyecto y la clave **publishable** (o la antigua `anon`). Define `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` como variables de entorno, según [`.env.example`](.env.example), y ejecuta `node configure.cjs`. Esto genera [`config.js`](config.js) con los datos públicos que necesita el navegador. También puedes rellenar ese archivo manualmente.
5. Publica estos archivos en un servidor estático con HTTPS. Para una prueba local, sirve la carpeta con un servidor HTTP y abre `index.html`; `admin.html` contiene el acceso de la administradora.

Antes de completar los pasos, los formularios permanecen deshabilitados. Los datos de la antigua demo guardados en `localStorage` no se envían automáticamente a Supabase.

El token personal `sbp_` sirve para administrar Supabase, no para iniciar sesión en la web. `configure.cjs` lo rechaza como clave del navegador. No guardes ese token, una contraseña ni una clave `service_role` en el repositorio o en `config.js`.

## Acceso y datos

- Supabase Auth comprueba el correo y la contraseña. La sesión se mantiene en ese navegador hasta cerrar sesión.
- La tabla `admin_users` decide qué cuentas pueden usar el panel. Las políticas RLS permiten a esas cuentas consultar y crear vehículos y servicios; no permiten a visitantes ni a otras cuentas escribir registros.
- La búsqueda pública usa `lookup_vehicle`, que devuelve marca, modelo, año, patente y datos del último servicio, sin nombre ni teléfono del cliente.
- Las patentes de autos aceptadas son el formato anterior `ABC123` y el formato Mercosur `AA123AA`. Espacios y guiones se quitan al escribir; el nombre admite letras y separadores habituales, y el teléfono admite de 8 a 15 dígitos. Estas reglas también se revisan en la base de datos.
- El próximo cambio se estima sumando **5.000 km** para aceite mineral, **7.500 km** para semisintético o **10.000 km** para sintético. La próxima fecha es seis meses después del servicio.

La patente funciona como dato de consulta pública: quien la conozca podrá ver el servicio más reciente de ese vehículo. Si se necesita limitar esa consulta, habrá que agregar otra forma de verificación antes de publicar el sitio.
