# Referencia iPhone y versión web instalable

La revisión se hizo sobre el código fuente del proyecto iPhone, sin descompilar ni modificar el IPA. La web conserva las diferencias solicitadas para escritorio y los mismos datos de Supabase.

| Función | Referencia iPhone | Web |
|---|---|---|
| Acceso y sesión | ParetoCoreApp.swift y KeychainStorage.swift | Acceso y restauración existentes; almacenamiento de sesión del navegador, no Keychain |
| Captura y edición | ScannerView.swift y FrictionUpdate.swift | Seis áreas, cinco niveles, descripción contextual y edición completa |
| Cálculos y gráficos | Analysis.swift, AreaAnalysis.swift y SituationPareto.swift | Dominio JS con pruebas de equivalencia existentes; Análisis permanece oculto según la preferencia web |
| Acciones y áreas | ActionsView.swift y ActionAreas.swift | Filtro, importancia, clasificación, vínculos y segunda acción; Nueva acción conserva pestaña propia |
| Propuesta de área | Área/período del foco nativo | Todo el historial del problema, como se solicitó para la web |
| Problemas apartados | FocusPreferences.swift y ArchivedProblemsView.swift | Continúan exclusivos de iPhone; no se transfieren preferencias de Keychain |
| Excel | ExcelReport.swift y ExcelStyle.swift | Exportador web existente, sin cambios de formato ni CSV |
| Presentación | SwiftUI con pestañas inferiores | Esmeralda, escritorio con navegación superior e inicio en Acciones; móvil con navegación inferior |
| Instalación | IPA firmado e instalado | Manifiesto web, iconos derivados del icono nativo y apertura standalone desde navegador |

La PWA no es un IPA ni utiliza SwiftUI. No incorpora IA, escritura offline, nuevas tablas ni migraciones. Mantiene la protección visual al ocultar la pestaña y los controles por propietario y cuenta existentes. Las funciones nativas del sistema no se presentan como capacidades del navegador.

## Qué se guarda al instalar

El service worker conserva únicamente una lista explícita de archivos públicos de la aplicación (HTML, CSS, JS, iconos y plantilla Excel). No intercepta ni guarda consultas externas, peticiones de escritura, configuración local ni respuestas de Supabase. Los registros consultados siguen en memoria y la sesión conserva el almacenamiento habitual del cliente Supabase.

Sin internet puede abrirse la interfaz ya instalada, con aviso de conexión. No se garantiza restaurar la sesión ni consultar, editar o guardar sin red; no hay cola de cambios. La primera apertura y descarga de la interfaz requieren conexión.

## Actualizaciones

Cada publicación que cambie archivos de la interfaz debe cambiar `VERSION` en `sw.js`. Se prepara una nueva caché completa. Si falla su descarga, la versión anterior permanece disponible. La nueva versión espera hasta que se pulse «Actualizar app»; el aviso pide guardar antes. Nunca se recarga automáticamente un borrador. Cada caché está separada por ruta para admitir alojamiento bajo una subcarpeta.

## Instalación

Se necesita HTTPS para la dirección publicada; localhost/127.0.0.1 se admite solo para probar en el propio computador. La dirección local del computador no sirve como enlace instalable del iPhone.

- iPhone: abrir la dirección publicada en Safari → Compartir → Agregar a pantalla de inicio → activar «Abrir como app web» si aparece → Agregar.
- Chrome/Edge de escritorio: usar «Instalar app» o la opción de instalación del navegador.
- Safari de Mac: usar la opción Agregar al Dock cuando esté disponible.

La instalación real desde la pantalla de inicio del iPhone y desde cada navegador queda pendiente de verificar en el dispositivo. No se publicó ningún sitio en esta entrega.

Referencias: [instalación en iPhone, Apple](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios), [requisitos de PWA, MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
