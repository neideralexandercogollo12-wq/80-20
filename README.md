# Pareto Core web · 2.1

Web instalable basada en los flujos de la compilación 36 del iPhone. Incluye captura y edición, Análisis por período, focos pendientes y apartados, detalles por área y problema, gráficos, acciones vinculadas y clasificadas y Excel. Sin IA. Consulta [IOS-WEB.md](IOS-WEB.md) para la comparación funcional y sus límites.

## Ejecutar

Desde esta carpeta:

```sh
python3 -m http.server 8012 --bind 127.0.0.1
```

Abre http://127.0.0.1:8012/. No abras index.html como archivo. La configuración local actual está en config.js, excluida de Git. En otro equipo copia config.example.js a config.js e introduce únicamente URL y clave pública del mismo proyecto Supabase; nunca claves secretas/service_role. Las dependencias están incluidas localmente y Supabase JS está fijado a 2.117.3.

## Pantallas

- **Móvil o app instalada:** Escáner, Análisis y Acciones. El inicio es Escáner y el formulario se encuentra dentro de Acciones, como en iPhone. Las barras usan tonos salvia; al escribir aparece Listo.
- **Pestaña de escritorio:** inicio en Acciones, Nueva acción independiente y navegación superior esmeralda. Análisis está accesible con las mismas funciones.
- **Escáner:** seis áreas, problema/emoción opcionales, reutilización de nombres y cinco niveles sin selección inicial, con descripción por área.
- **Análisis:** Hoy, Semana, 30 y 90 días; semanas anterior/actual/siguiente; métricas, focos pendientes, distribución, historial oculto inicialmente, búsqueda/filtros y paginación. Los detalles conservan el área y período, con barras de situaciones y Pareto avanzado opcional.
- **Focos:** Omitir los aparta; Ver apartados permite recuperarlos. Guardar una acción preparada desde un foco aparta solo las situaciones revisadas; cancelar o fallar no lo aparta. Una situación nueva lo devuelve a pendientes. La segunda acción no oculta casos nuevos.
- **Acciones:** texto e importancia vacíos al preparar, etiqueta del problema, área opcional, filtro por área, progreso de la selección, orden por importancia, completar, eliminar, cambiar/quitar área y añadir otra acción vinculada. El borrador pide confirmación antes de reemplazarse.
- **Propuesta de área:** desde un área se hereda; desde un foco se usa su carga del período; en el selector manual de problema se usa todo el historial. Los empates permiten elegir o continuar Sin área. Un área guardada no se recalcula.

## Privacidad y datos

Se conservan proyecto, tablas y políticas Supabase. Consultas y modificaciones filtran por propietario e identificador y detectan registros inexistentes. Los registros permanecen en memoria; las respuestas tardías de otra cuenta no se aplican. Guardar/editar/borrar requiere internet, sin cola offline.

La sesión usa la persistencia del cliente Supabase del navegador; no Keychain. Recordar mi correo guarda solo el correo y lo elimina al desactivarse. Las preferencias de problemas apartados se guardan adicionalmente por cuenta en localStorage (claves SHA-256, corte temporal e identificadores revisados), sin texto de situaciones. Se conservan al cerrar sesión para recuperarlas con esa cuenta; memoria, borradores y filtros se limpian. No se sincronizan con el iPhone ni otros navegadores.

Omitir/recuperar solo cambia la lista de atención; cifras, registros, gráficos y Excel siguen completos. Si la preferencia falla después de crear una acción, la acción se conserva y el aviso evita guardarla nuevamente.

El contenido se cubre al ocultar la pestaña. Las miniaturas del navegador/sistema no están totalmente bajo control de una web. La PWA cachea solo archivos públicos de interfaz, nunca configuración ni respuestas de Supabase. Abrirla sin red no permite operar sobre datos.

## Excel

Abre Ver informe desde Análisis o Acciones. La vista previa empieza con el período actual de Análisis (Semana al iniciar) y permite elegir Hoy, Semana, 30 o 90 días y navegar entre semanas sin cambiar el dashboard. Áreas muestra tabla y gráfico; Situaciones muestra tabla y barras salvia 1–5; Datos conserva todas las columnas. Situaciones y Datos se paginan de diez en diez. Solo Descargar Excel, dentro del informe, inicia la descarga y siempre incluye todo el período, no solo la página visible. Actualizar solicita una nueva copia; descargar usa exactamente la copia mostrada, sin volver a consultar. Áreas, Situaciones y Datos conservan tablas nativas filtrables y gráficos que respetan filas visibles, sin tarjetas, etiqueta de período ni bordes negros. No exporta tareas. CSV continúa retirado.

## Instalar

En una dirección **HTTPS** accesible desde el dispositivo:

- iPhone: Safari → Compartir → Agregar a pantalla de inicio → activar Abrir como app web si aparece → Agregar.
- Computador: Instalar app o la opción de instalación/Agregar al Dock del navegador.

127.0.0.1 solo sirve en el computador donde se ejecuta el servidor; no es una dirección instalable desde el iPhone. La instalación no elimina el requisito de internet para los datos.

La nueva versión avisa y espera a que pulses Actualizar app después de guardar. Para futuras modificaciones, incrementa VERSION en sw.js. El manifiesto y las rutas admiten publicación bajo una subcarpeta.

## Publicar (lo realiza el usuario)

1. Sube el contenido de web-release a la raíz del repositorio, incluidos assets, js, vendor, manifest.webmanifest, sw.js, tests, .nojekyll y .github. No subas iPhone ni config.js local.
2. En Variables de GitHub Actions configura SUPABASE_URL y SUPABASE_ANON_KEY con los valores públicos.
3. En Pages elige GitHub Actions y ejecuta Publicar Pareto Core.

El flujo verifica el dominio y prepara todos los archivos, incluida la configuración pública. Esta entrega no ejecuta la publicación ni genera ZIP.

## Pruebas

```sh
node --test tests/core.test.cjs tests/focus.test.cjs
node tests/native-browser.cjs
node tests/browser.cjs
node tests/edge-browser.cjs
node tests/layout.cjs
node tests/actions-areas.cjs
node tests/motion.cjs
node tests/actions-export.cjs
node tests/report-preview.cjs
node tests/static.cjs
node tests/pwa.cjs
```

Los recorridos de navegador requieren Playwright en el entorno de desarrollo (no forma parte del sitio). PLAYWRIGHT_MODULE permite indicar su ubicación; TEST_WEBKIT=1 activa WebKit en native-browser.cjs y actions-areas.cjs. Se usa Supabase simulado sin escrituras personales. pwa.cjs prueba el service worker real bajo servidor local. La revisión física en iPhone y la instalación desde HTTPS siguen pendientes; ver VERIFICATION.md.

Al completar o volver a pendientes una acción, la lista se actualiza sin vaciarse ni volver al inicio; conserva el contexto visual próximo a la acción marcada. Prueba específica: `node tests/action-scroll.cjs`, también con `TEST_WEBKIT=1`.

La vista previa se mantiene únicamente en memoria y se descarta al cerrar, cambiar cuenta o pasar a segundo plano. Incluye carga, error/reintento y retorno de foco al acceso original; no incorpora tareas, acciones ni CSV.

La vista previa del informe tiene fondo blanco, texto oscuro y encabezados salvia. Cada columna permite filtrar: selección exacta para áreas y números, y búsqueda de texto para situaciones, eventos, emoción y problema. Se combinan filtros de una misma sección y se conservan al cambiar de pestaña; Limpiar filtros borra los de la sección actual. Cambiar el período o cerrar el informe los reinicia. Actualizar conserva los filtros del período abierto. Los gráficos y la paginación siguen las filas filtradas de su sección. Los filtros no se aplican a la descarga: el Excel conserva todo el período y sus filtros nativos independientes.

Prueba adicional: `node tests/report-filters.cjs` (también admite `TEST_WEBKIT=1`).
