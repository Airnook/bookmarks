# Contribuir

[🇬🇧 English](../../.github/CONTRIBUTING.md) | [🇷🇺 Русский](../ru/CONTRIBUTING.md) | **🇪🇸 Español** | [🇧🇷 Português (Brasil)](../pt-BR/CONTRIBUTING.md) | [🇫🇷 Français](../fr/CONTRIBUTING.md) | [🇩🇪 Deutsch](../de/CONTRIBUTING.md) | [🇨🇳 中文（简体）](../zh-CN/CONTRIBUTING.md) | [🇯🇵 日本語](../ja/CONTRIBUTING.md) | [🇮🇳 हिन्दी](../hi/CONTRIBUTING.md) | [🇸🇦 العربية](../ar/CONTRIBUTING.md)

La extensión es JavaScript puro (Manifest V3) sin paso de compilación: el navegador carga tal cual los archivos de la
raíz del repositorio. Las páginas (`panel.html`, `options.html`, `help.html`) cargan módulos ES (`<script type="module">`)
con importaciones explícitas; lo que comparten está en `commands.js`. El script en segundo plano `background.js` es un
service worker normal, no un módulo. El código del panel está dividido en módulos en `panel/`; el arranque y el orden de
las suscripciones a eventos están en `panel/main.js`, y el estado mutable compartido en `panel/state.js`. El texto de la
interfaz está en `_locales/<idioma>/messages.json` (`chrome.i18n` estándar) y lo muestra `i18n.js` (`t`, plurales,
dirección de la página). Las herramientas de desarrollo (`package.json`, `eslint.config.js`, `test/`, `scripts/`) no
forman parte de la versión publicada.

### Módulos del panel

Los módulos de `panel/` se importan entre sí solo de arriba abajo, sin ciclos — lo comprueba `test/panel-imports.test.js`
(e imprime la ruta del ciclo si lo hay). Las capas, de abajo arriba:

1. sin dependencias del panel: `util`, `dom`, `url`, `search`, `place` (dónde queda un elemento movido), luego `state`,
   `nodes`, `history` (historial de ediciones para deshacer y rehacer: todo cambio de marcadores hecho desde el panel
   pasa por su `begin()`);
2. `ui` (diálogo de confirmación, mensajes, foco), `keymap` (indicaciones de teclas), `tree` (lectura del árbol, caché de
   nodos);
3. `search-index` (índice de búsqueda), `tabs`, `marks`;
4. `render`, luego `find` (entrar y salir de la búsqueda), `open`, `edit`, `palette` (elegir de una lista);
5. `move-to`, `link`, `search-input`;
6. `actions` (qué hace cada comando);
7. `keys`, `mouse`, `drag` (arrastrar y soltar con el ratón), luego `main`.

Un módulo importa solo de las capas inferiores. Cuando un módulo inferior necesita llamar a uno superior, no lo importa,
sino que recibe la llamada desde fuera: `tree` llama a `onTreeApplied(callback)` tras cada lectura del árbol (`main.js`
establece el redibujado), y `openPalette(run)` ejecuta el comando elegido mediante el `run` que recibe. El estado que
necesitan varias capas vive en `state` (por ejemplo, `state.pending` — una secuencia de teclas en curso: `keys` la
gestiona y `palette` también la cancela). No hay bus de eventos: un callback se establece explícitamente, en un solo
lugar, al arrancar. `main.js` define el orden de las suscripciones a eventos, y importa cuando varios manejadores
escuchan el mismo evento.

## Desarrollo

Se requiere Node.js 20.19+, 22.13+ o 24+ (un requisito de ESLint 10).

```sh
npm ci            # install dependencies
npm run lint      # ESLint
npm test          # tests (node --test)
npm run package   # build dist/airnook-bookmarks-<version>.zip and check the archive
npm run test:browser  # smoke test in Chromium (needs npx playwright install chromium)
```

Para ejecutar la extensión: `chrome://extensions` → «Modo de desarrollador» → «Cargar descomprimida» → la raíz del repositorio.

### Linter

Las páginas son módulos ES: todo lo que un archivo toma de otro (`COMMANDS`, `chordOf` de `commands.js`, etc.) lo
importa explícitamente; de lo contrario, el linter avisa de un nombre desconocido. El linter no permite un `catch {}`
vacío: escriba dentro por qué se puede ignorar el error.

### Pruebas

Las pruebas importan directamente los módulos sin DOM (`commands.js`, funciones puras del panel en `panel/`).
`background.js` no es un módulo, así que las pruebas lo cargan mediante `node:vm` con un stub de `chrome` (véase
`test/load.js`); la página de opciones también se carga mediante `node:vm` con stubs del DOM (véase `test/options-page.js`).

`npm run test:browser` construye el archivo, carga la extensión en el Chromium de Playwright y comprueba las páginas y
las teclas principales del panel: una ejecución por cada idioma de `_locales/`, más hebreo sin traducción y un hebreo
ficticio de derecha a izquierda. Solo algunos idiomas: `SMOKE_LOCALES=ru,en npm run test:browser` (los nombres son
carpetas de `_locales`, `he`, `he-rtl`). No forma parte de `npm test` ni de CI: puede que allí no haya navegador.

### Empaquetado

El contenido del archivo es una clausura de referencias: `manifest.json` → todo lo que referencia (service worker,
páginas, iconos) → para cada página html sus `<script src>`, `<link href>` e `<img src>`, para cada script sus `import`
estáticos y `export … from` → recursivamente. Más la carpeta `_locales/`, si existe, y las páginas de `EXTRA_PAGES` en
`scripts/package.mjs`: el código las abre por nombre (por ejemplo, `help.html`), así que las referencias no las
encuentran. Nada más, incluidos los nuevos archivos auxiliares en la raíz, entra en el archivo.

Si un `.js` de la extensión obtiene una referencia a una página html nueva que no está en el archivo, la compilación
falla con la sugerencia de añadirla a `EXTRA_PAGES`. Tras la compilación, una comprobación aparte asegura que el archivo
no tenga `package.json`, configuraciones del linter, `test/`, `scripts/`, `.github/`, `README*.md`, `docs/` (imágenes
del README), `LICENSE`, `TODO.md`, `CONTRIBUTING*.md` ni archivos ocultos, y que todas las referencias estén en su
sitio; si hay un error, el comando termina con un código distinto de cero.

CI (`.github/workflows/ci.yml`) hace lo mismo en cada push y pull request hacia `dev` y `main`.

## Traducciones

La traducción de la interfaz está en `_locales/<idioma>/messages.json`. Cómo añadir un idioma o corregir una traducción,
y qué comprueba `npm test`, está en [TRANSLATING.md](TRANSLATING.md). Una carpeta nueva en `_locales/` se detecta
automáticamente; no hacen falta cambios de código.

## Publicar una versión

1. Suba `version` en `manifest.json` y fusione el cambio en `main`.
2. En `main`, cree la etiqueta `vX.Y.Z`, donde `X.Y.Z` es exactamente la versión de `manifest.json`:

   ```sh
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. El workflow `release.yml` comprueba que la etiqueta coincide con la versión, ejecuta lint y pruebas, construye el
   archivo y publica un GitHub Release con `airnook-bookmarks-X.Y.Z.zip`.

Si la etiqueta y la versión no coinciden, el workflow falla antes de la compilación: elimine la etiqueta
(`git push --delete origin vX.Y.Z`), corrija la versión e inténtelo de nuevo.
