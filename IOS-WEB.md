# Port funcional del iPhone

La primera entrega instalable conservaba la distribución de escritorio y no trasladaba todos los flujos del IPA. Esta revisión utiliza los fuentes de la compilación 36 del iPhone para recuperar esos flujos. No se modificó el proyecto iPhone ni se descompiló el binario.

## Funciones trasladadas y verificadas

| Referencia del iPhone | Función en la web |
|---|---|
| ParetoCoreApp.swift | En móvil y modo instalado: Escáner, Análisis y Acciones; inicio en Escáner y protección al pasar a segundo plano |
| ScannerView.swift | Seis áreas, emoción y problema opcionales, reutilización explícita de nombres, niveles sin selección y explicación contextual; limpieza tras guardar |
| AnalysisView.swift | Hoy, Semana, 30/90 días, semanas anterior/actual/siguiente, métricas, foco principal por área y problema pendiente principal |
| FocusDisposition.swift | Omitir, pendientes que reaparecen con situaciones nuevas y conservación de cálculos e informes completos |
| ArchivedProblemsView.swift | Ver apartados del período, recuperar individualmente y estado vacío; cierre al cambiar período, semana, cuenta o apartado |
| PrepareProblemActionButton.swift | Acción vacía, importancia sin seleccionar, vínculo al problema, área por contexto del foco, resolución de empate y confirmación de borrador |
| AppState.swift | Retirar un foco solo después de guardar la acción; revisar por identificadores para no ocultar situaciones nuevas durante la escritura; aviso si falla la preferencia sin duplicar la acción |
| AreaDetailView.swift | Resumen del área, participación en el período, barras por situación, Pareto avanzado, problemas del área e historial paginado con edición/borrado |
| ProblemDetailView.swift | Cifras y áreas relacionadas del problema, registros limitados al área/período abiertos, preparación de acción y omisión |
| SituationLevelsView.swift | Barras 1–5 con número, nombre, texto y tonos salvia en móvil/modo instalado; acceso al registro |
| ActionsView.swift | Formulario dentro de Acciones en móvil/modo instalado, áreas, progreso filtrado, importancia, completar, eliminar y añadir otra acción vinculada sin ocultar casos nuevos |
| Components.swift | Listo al escribir en móvil/modo instalado, cierre al guardar/cambiar apartado y conservación de saltos de línea |
| FrictionUpdate.swift | Edición completa, campos opcionales vacíos, conservación de identidad/fecha/respaldo y errores con reintento |
| ExcelReport.swift | Informe Excel con Áreas, Situaciones y Datos, tablas filtrables y gráficos; exportador existente conservado |

Los cálculos y gráficos reutilizan el dominio JavaScript existente, con pruebas de equivalencia respecto a Swift. Omitir o recuperar no elimina registros, no reclasifica ni altera la carga ni el 80/20. El 80/20 siempre utiliza todos los registros clasificados del contexto.

## Diferencias que siguen existiendo

- En una pestaña de escritorio se conserva inicio en Acciones y Nueva acción independiente; **Análisis vuelve a estar accesible**. En móvil o al instalar la PWA, las tres secciones y el formulario integrado siguen el flujo del IPA.
- El selector manual de problema, añadido específicamente para la web, sigue proponiendo área a partir de todo el historial. Preparar desde un foco usa sus registros del período; desde un área hereda esa área. Las áreas de acciones guardadas nunca se recalculan automáticamente.
- El navegador guarda la sesión con Supabase, no con Keychain. Las preferencias de focos se guardan por cuenta en este navegador: clave SHA-256 del problema, corte temporal e identificadores revisados. No se guardan textos de situaciones ni respuestas de Supabase. No se sincronizan con las preferencias Keychain del IPA ni entre dispositivos. Al salir se limpia el estado de memoria; las preferencias persistentes se recuperan al volver a esa cuenta.
- Excel se previsualiza en Ver informe (Áreas, Situaciones y Datos), con período independiente y descarga opcional desde la misma copia; el archivo se descarga mediante el navegador; no es la hoja nativa de compartir. CSV continúa retirado por la decisión anterior del usuario. No se incorpora IA.
- SwiftUI, Keychain, el teclado del sistema y el selector de aplicaciones no se pueden reproducir literalmente en HTML. La cubierta de privacidad web no garantiza ocultar capturas previas realizadas por el navegador/sistema.

## Instalación, conexión y actualizaciones

La PWA conserva manifiesto standalone e iconos derivados del icono nativo. Para instalar en iPhone, debe abrirse la dirección publicada HTTPS en Safari y usar Compartir → Agregar a pantalla de inicio → Abrir como app web. Localhost sirve solo en el computador que ejecuta el servidor.

La caché del service worker contiene únicamente archivos públicos de la interfaz; excluye configuración, preferencias, consultas y respuestas. La sesión y las preferencias siguen sus almacenamientos separados. Sin conexión puede abrirse la interfaz almacenada, pero consultar y guardar requiere internet. No hay cola de escrituras.

Cada publicación que cambie archivos públicos debe incrementar VERSION en sw.js. La nueva caché espera la confirmación «Actualizar app» antes de activarse y recargar; el aviso indica guardar antes el borrador.

No se publicó ningún sitio ni se generó IPA/ZIP. La instalación real desde HTTPS y la revisión en un iPhone físico siguen pendientes. Las pruebas automatizadas de navegador y modo instalado simulado se distinguen de esas comprobaciones.
