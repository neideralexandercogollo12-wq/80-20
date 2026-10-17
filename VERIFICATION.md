# Verificación · Pareto Core web 2.1

Fecha: 14 de octubre de 2026. Referencia funcional: iPhone 2.1, compilación 30. La aplicación nativa y la web anterior no se modificaron.

## Pruebas realizadas

- **20 pruebas de dominio, servicio y exportación aprobadas**, sin fallos. Incluyen las 30 descripciones contextuales, períodos, escala, campos opcionales, límites, áreas heredadas, CSV, tablas Excel, listas largas e invalidación por cuenta y período.
- **Equivalencia Swift/JavaScript comprobada** ejecutando el dominio nativo sobre seis conjuntos sintéticos y comparando carga, medias, grupos, orden, porcentajes, áreas y puntos Pareto. La salida de referencia quedó en `tests/parity-fixtures.json` para futuras regresiones.
- **14 pruebas anteriores de la web aprobadas** desde la raíz del proyecto. La entrega independiente tiene sus propias pruebas y no depende de esos archivos para ejecutarse.
- **Chromium, datos simulados:** inicio y restauración de sesión, recordar y olvidar correo, captura y reinicio sin nivel, cambio de área, edición completa, cancelación, error con reintento, gráficos y detalles, historial, acciones, descargas Excel/CSV y cierre de sesión con lecturas pendientes.
- **Casos adicionales en Chromium:** problema compartido entre áreas, denominador clasificado del área, reclasificación que deja el detalle vacío, historial de 25 registros en páginas de diez, conservación de área anterior, borrado confirmado y cancelado, edición de un registro eliminado con conservación del borrador, protección de borrador de acciones, navegación por teclado, cambio de cuenta durante un guardado y expiración de sesión.
- **WebKit móvil simulado:** acceso, análisis y ausencia de desbordamiento horizontal a 390 × 844. La revisión visual adicional en Chromium incluyó móvil y escritorio.
- **Contraste de números salvia sobre las tarjetas:** 10,30:1, 8,05:1 y 5,65:1; todos superan 4,5:1.
- **Carga estática bajo subcarpeta:** cliente Supabase real, configuración local y plantilla Excel cargados sin errores ni archivos faltantes. Se corrigió y volvió a probar la interacción entre `INITIAL_SESSION` y la comprobación inicial de sesión.
- **Supabase existente:** las tablas `fricciones` y `palancas` respondieron HTTP 200 a consultas con `limit=0`, usando la configuración pública. No se consultaron registros personales ni se hicieron escrituras reales. Las pruebas de usuario se ejecutaron con un servicio simulado y las consultas incluyen filtro por propietario.

## Excel

El archivo descargado desde la interfaz web pasó la comprobación CRC del archivo y el análisis de sus 22 partes XML/relaciones. Conserva la relación raíz `_rels/.rels`.

Se abrió en **Microsoft Excel para Mac sin reparación**. Se revisaron las hojas Áreas y Situaciones: encabezados salvia, separadores suaves, filtros, ausencia de tarjetas y etiqueta de período y etiquetas de barras con el texto de la situación.

Se filtró Situaciones por área: de cuatro registros quedaron uno y su barra correspondiente. Al limpiar el filtro reaparecieron las cuatro barras. Se ordenó por área y se comprobó que texto, nivel y área permanecieran juntos y que la longitud de las barras correspondiera a los valores.

La plantilla también se importó y recalculó en Artifact Tool: no se encontraron errores de fórmula. Se generaron vistas de las tres hojas para revisar su contenido. Los archivos de comprobación usan exclusivamente datos sintéticos y no forman parte de la entrega.

Excel conserva los colores asignados a posiciones del gráfico al ordenar manualmente; el orden inicial aplica los tonos por nivel y las cifras/longitudes siguen siendo la referencia tras ordenar. Las alturas de fila respetan el límite de Excel de 409,5 puntos.

## Pendientes de dispositivo y publicación

- Inicio de sesión y operaciones con una cuenta real desde el navegador del usuario; no se introdujeron sus credenciales durante las pruebas.
- Safari en iPhone físico, teclado del sistema, hoja de descargas/compartir y VoiceOver real. Las alternativas textuales, controles etiquetados y navegación por teclado están implementados; las pruebas automáticas no sustituyen una revisión con lector de pantalla.
- Excel móvil, especialmente textos muy largos y comportamiento de filtros en esa aplicación.
- Publicación real en GitHub Pages: el usuario la realizará con el flujo incluido. No se creó repositorio ni se publicó contenido.

Las funciones existentes requieren internet para Supabase. No hay IA, almacenamiento sin conexión de registros ni migraciones nuevas.

## Ajuste exclusivo de web: escritorio y paleta original

- Fondo `#030712`, tarjetas `#111827` y acento esmeralda `#10B981`; los gráficos web usan verdes esmeralda. El formato salvia del Excel se conserva.
- Desde 768 px, el acceso y la restauración de sesión abren Acciones. La lista Pendientes precede a las completadas, el progreso y el formulario. La navegación superior sigue Acciones → Análisis → Escáner.
- Bajo 768 px se conserva el inicio en Escáner, el formulario antes de la lista y la navegación inferior. Cambiar el ancho reorganiza los elementos reales del documento, conservando campos y apartado activo.
- `tests/layout.cjs` comprobó inicio, orden, posición superior/inferior, pendientes en el primer tramo de pantalla, conservación de borrador al redimensionar y colores del gráfico; se revisó una captura de escritorio con datos simulados.
- Las 20 pruebas de dominio siguen aprobadas. Se ajustó el recorrido de captura para entrar explícitamente al Escáner desde el nuevo inicio de escritorio y se repitieron los flujos de navegador.

## Exportación únicamente a Excel

Se retiraron el botón de CSV, su descarga y el generador no utilizado de la versión web independiente. Excel se conserva. Pasaron las 19 pruebas vigentes de dominio/exportación y el recorrido Chromium, incluyendo ausencia del botón CSV y descarga de Excel. Los resultados anteriores de CSV describen comprobaciones históricas, previas a esta retirada.

## Acceso discreto a Excel desde Acciones

Se añadió Descargar Excel junto a Actualizar, sin un bloque adicional. Comparte el informe existente de fricciones y su período; permite exportar directamente al entrar, consultando los registros sin exigir una visita previa a Análisis. Se comprobó descarga inicial semanal, selección de 30 días, error con reintento y descarte de una respuesta pendiente al cerrar sesión con Supabase simulado. Las 19 pruebas de dominio continúan aprobadas.

## Análisis oculto en la navegación web

El botón Análisis queda oculto tanto en escritorio como en móvil y fuera del recorrido de teclado. Se conserva el código del informe para Excel y una futura recuperación del apartado. La navegación visible muestra Acciones/Escáner en PC y Escáner/Acciones en móvil. Las pruebas de funciones internas de Análisis lo abren programáticamente solo desde el entorno de pruebas. Se comprobaron ambos tamaños y la descarga desde Acciones.

## Renovación visual de Acciones, Escáner y acceso

Se priorizó el aspecto visual, según la elección del usuario: se conservaron los controles y los formularios, sin plegar secciones ni introducir pasos nuevos. Desde 1100 px, las pendientes ocupan la columna principal y el formulario una columna lateral. La navegación esmeralda, tipografía, campos, filas, selector de importancia, papelera accesible y franja de progreso comparten un acabado más compacto.

Se revisaron capturas de escritorio y móvil y se verificó conservación del borrador al redimensionar. Los recorridos Chromium y WebKit pasaron con datos simulados: sesión, captura, edición, gráficos internos, acciones y descarga de Excel. Las pruebas de distribución comprueban la columna lateral y la ausencia de desbordamiento horizontal. La app iPhone y la configuración de Supabase no se modificaron.

## Nueva acción en pestaña independiente

Se reemplazó la columna lateral por una pantalla propia de Nueva acción, accesible desde la navegación superior en escritorio y las pestañas inferiores en móvil. Acciones mantiene únicamente la lista, el progreso y sus controles. Se conserva el borrador al cambiar de pestaña o ancho; al guardar se regresa a Acciones, y un error deja el formulario abierto con su contenido. Preparar una acción desde las funciones internas abre la nueva pestaña.

Se comprobaron navegación en ambos tamaños, ausencia del formulario en la lista, conservación de borrador, error/reintento y retorno después del guardado con servicios simulados.

## Actualización de Acciones: áreas y vínculos

Verificado el 15 de octubre de 2026:

- 23 pruebas de dominio/estado/servicio/exportación aprobadas, incluidas agregación de todo el historial, normalización, empates, áreas retiradas, filtro y orden, vínculos huérfanos, NULL explícito, error con conservación del borrador e invalidación por cuenta.
- Recorrido nuevo con Supabase simulado: filtros y progreso, vínculo del iPhone, segunda acción vacía, cancelar, confirmación rechazada de reemplazo, sugerencia desde registros antiguos, empate y cancelación, cambio manual, desvinculación, error de guardado y reintento, retirada de área, error/reintento de sugerencias sin sobrescribir campos, móvil y escritorio sin desbordamiento.
- Recorridos existentes aprobados: acceso/sesión, edición/historial/gráficos internos, respuestas tardías, navegación exclusiva, teclado y distribución, descarga Excel y servidor estático bajo subcarpeta con dependencias locales reales.
- No se modificaron iPhone, esquema, políticas, datos personales ni exportador Excel. No se publicaron archivos ni se generó ZIP.

Las comprobaciones de navegador utilizan datos simulados. Queda pendiente la revisión con tu cuenta y dispositivos reales; esta entrega no vuelve a certificar Excel de escritorio/móvil, pues el exportador permanece sin cambios.

## Transiciones al agregar y borrar

Las acciones nuevas tienen una entrada breve; el Escáner confirma el guardado con un realce tenue. Los registros y acciones eliminados se desvanecen durante 180 ms únicamente después de que el servicio confirme el borrado y antes del refresco. Un fallo conserva la fila. Los avisos aparecen suavemente. Se respeta `prefers-reduced-motion`, sin animaciones de entrada, salida o confirmación para esa preferencia.

Verificación: 23 pruebas de dominio/estado aprobadas y recorrido general Chromium de captura, edición, historial, acciones y Excel aprobado. El recorrido específico `tests/motion.cjs` comprueba alta, error sin salida, borrado confirmado y movimiento reducido con Supabase simulado. Revisión subjetiva de las transiciones en dispositivos reales pendiente. Sin cambios en iPhone, datos ni Supabase.

## Confirmación de eliminación integrada

Se sustituyó el aviso nativo del navegador al borrar acciones y situaciones por un diálogo compacto del diseño oscuro/esmeralda. Incluye Cancelar y Eliminar; el foco inicial queda en Cancelar y Escape cierra sin borrar. Se cancela al cambiar de cuenta o pasar a segundo plano y se valida la cuenta antes de continuar. La salida animada sigue ocurriendo solo después de confirmar el borrado en el servicio. Pruebas simuladas de confirmación, Escape, errores y movimiento reducido aprobadas.

## Web instalable (PWA) · 16 de octubre de 2026

Se compararon los fuentes SwiftUI y de dominio con la web. `IOS-WEB.md` registra qué funciones se comparten y las diferencias elegidas para escritorio. Se añadieron manifiesto standalone, iconos PNG derivados del icono nativo, icono Apple, ayuda de instalación e insets para pantalla de inicio. El flujo de publicación incluye manifiesto y service worker; no se ejecutó publicación.

Verificado con servidor HTTP local bajo `/pareto/` y Chromium con service worker real (`tests/pwa.cjs`):

- Manifiesto y alcance relativos, iconos PNG de 192 y 512 píxeles y metadatos Apple.
- Descarga de interfaz, control del service worker y caché limitada a archivos públicos. No contiene `config.js`, consultas ni respuestas de Supabase.
- Actualización versionada, preparación de nueva caché, aviso sin recarga del borrador, activación manual y retirada de la caché anterior.
- Apertura de interfaz sin red, aviso de conexión y recuperación al reconectar. Además de `navigator.onLine`, se comprueba disponibilidad mediante HEAD al archivo público de configuración, sin almacenarlo.
- Ayuda de instalación para iPhone, revisión visual de su diálogo en 390 × 844 y ausencia de desbordamiento.

También aprobaron las 23 pruebas de dominio/estado/servicio/Excel y los recorridos de navegador de captura/sesión, distribución, áreas y vínculos de acciones, transiciones, exportación y servidor estático con el cliente real. Las pruebas funcionales emplean Supabase simulado; no hubo escrituras sobre datos personales.

Pendiente: instalación desde HTTPS publicado en el iPhone real y en navegadores de escritorio, apertura real desde su icono y revisión del selector de aplicaciones del sistema. La emulación móvil y el manifiesto validado no certifican esa instalación. No se generó IPA ni ZIP ni se modificó el proyecto iPhone.
