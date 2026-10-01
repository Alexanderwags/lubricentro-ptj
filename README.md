# Lubricentro PTJ — demo estática

Landing pública y panel de registro para un lubricentro, hechos con HTML, Tailwind CSS por CDN y JavaScript puro. Esta versión permite revisar el diseño y probar los flujos antes de conectar Supabase.

## Abrir la demo

Abre `index.html` en un navegador. Busca la patente **PTJ123** para ver una ficha de ejemplo. En `admin.html`, pulsa **Entrar a demo** para registrar vehículos y servicios. Los cambios se guardan únicamente en el `localStorage` de ese navegador.

Si prefieres servir los archivos localmente, cualquier servidor estático funciona. No se requiere Node.js, npm ni un proceso de compilación. También se pueden publicar los archivos tal como están en GitHub Pages o en un alojamiento estático.

## Estructura

- `index.html`: página pública, buscador y resultado del último servicio.
- `admin.html`: entrada a la demo, formularios y listado de servicios.
- `app.js`: datos de ejemplo, búsqueda, validaciones, cálculos y almacenamiento local.
- `assets/hero-garage.png`: imagen original generada para el hero.

## Reglas de la demo

El próximo cambio suma **5.000 km** para aceite mineral, **7.500 km** para semisintético o **10.000 km** para sintético. La próxima fecha es seis meses después de la fecha del servicio. Cuando el día no existe en el mes de destino, se usa el último día de ese mes.

Esta versión **no tiene autenticación real**: el botón de acceso solo abre la vista de demostración. Los datos de ejemplo y los que se ingresen quedan en el navegador. No uses datos personales reales. Supabase, sus tablas, el esquema SQL y las políticas de acceso se añadirán en una siguiente etapa.

## Personalización

Los colores principales están definidos en la configuración de Tailwind dentro de cada HTML. Al integrar Supabase, se debe sustituir la persistencia local de `app.js` por consultas al cliente oficial y activar autenticación y políticas RLS antes de usar datos reales.
