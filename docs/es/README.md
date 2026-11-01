# Airnook Bookmarks

[🇬🇧 English](../../.github/README.md) | [🇷🇺 Русский](../ru/README.md) | **🇪🇸 Español** | [🇧🇷 Português (Brasil)](../pt-BR/README.md) | [🇫🇷 Français](../fr/README.md) | [🇩🇪 Deutsch](../de/README.md) | [🇨🇳 中文（简体）](../zh-CN/README.md) | [🇯🇵 日本語](../ja/README.md) | [🇮🇳 हिन्दी](../hi/README.md) | [🇸🇦 العربية](../ar/README.md)

[![CI](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml/badge.svg)](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/Airnook/bookmarks)](https://github.com/Airnook/bookmarks/releases/latest)
[![Chromium 141+](https://img.shields.io/badge/Chromium-141%2B-4285F4?logo=googlechrome&logoColor=white)](https://www.chromium.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![10 languages](https://img.shields.io/badge/languages-10-orange)](TRANSLATING.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)

**Marcadores** es una extensión para navegadores Chromium (Chrome, Edge, Brave, Arc, Helium y otros): tus marcadores en
el panel lateral, junto a la página, todo con el teclado. Buscar, abrir, clasificar en carpetas, mantener los marcadores
como pestañas fijas. Nació al pasar de Arc a un navegador Chromium: se echaba de menos su panel lateral.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../panel-dark.png">
    <img src="../panel-light.png" alt="El panel lateral de Marcadores: un árbol de carpetas con dos marcadores seleccionados" width="360">
  </picture>
</p>

## Contenido

- [Funciones](#funciones)
- [Instalación](#instalación)
- [Inicio rápido](#inicio-rápido)
- [Teclas predeterminadas](#teclas-predeterminadas)
- [Privacidad](#privacidad)
- [Traducciones](#traducciones)
- [Desarrollo](#desarrollo)
- [Licencia](#licencia)

## Funciones

- ⌨️ **Un atajo para el panel**: `Alt+B` (`⌥B` en Mac) abre el panel, le devuelve el foco desde la página y lo cierra.
  Se cambia en `chrome://extensions/shortcuts`.
- 📌 **Marcadores como pestañas fijas**, como en Arc: un punto en los marcadores con una pestaña abierta (y un anillo en
  una carpeta contraída con algo abierto dentro). Abrir de nuevo un marcador cambia a su pestaña, `Shift+Enter` devuelve
  la pestaña a la dirección del marcador, `U` guarda en el marcador la dirección actual. El modo se puede desactivar en
  la configuración.
- 🔎 **Búsqueda**: `/` o `⌘F`/`Ctrl+F`, por título, dirección y carpeta, con resaltado. `Tab` muestra el resultado en su
  lugar del árbol.
- 🗂️ **Clasificar marcadores**: selección (`Espacio`, `Shift+↑↓`, `⌘A`), mover a una carpeta por su nombre (`M`, las
  carpetas recientes primero; si no existe, la crea), mover por la lista (`Alt+↑↓`), carpeta nueva (`N`), cambiar nombre
  (`R`), eliminar (`D`), copiar direcciones (`C`).
- ↩️ **Deshacer y rehacer** (novedad de 2.6): `⌘Z` / `⌘⇧Z` en Mac, `Ctrl+Z` y `Ctrl+Shift+Z` o `Ctrl+Y` en el resto, o
  el botón «Deshacer» del mensaje. Una carpeta eliminada vuelve con su contenido. El historial guarda 50 pasos y es
  común a todas las ventanas hasta que se cierra el navegador.
- 🖱️ **Arrastrar y soltar** (novedad de 2.6): arrastra con el ratón marcadores, carpetas y la selección encima, debajo o
  dentro de una carpeta. La carpeta se abre si mantienes un elemento sobre ella, y la lista se desplaza cerca del borde.
- 📋 **Menú del botón derecho** (novedad de 2.6), como el de marcadores del navegador: abrir en una pestaña nueva, una
  ventana nueva, vista dividida o una ventana de incógnito; editar; cortar, copiar y pegar; eliminar; añadir página o
  carpeta; abrir el administrador de marcadores. Con el teclado: `Shift+F10`.
- 📂 **Abrir como conjunto**: los marcadores seleccionados o una carpeta entera, como grupo de pestañas con nombre o
  como pestañas normales. Las pestañas ya abiertas no se duplican.
- 🎛️ **Paleta de comandos**: `⌘K`/`Ctrl+K` o `?`: todos los comandos con sus teclas.
- 🔧 **Tus propias teclas**: cualquier comando se puede reasignar en la configuración. Hay un conjunto Vim, secuencias
  (`G G`) y pulsaciones dobles. Las teclas se reconocen por su posición, así que funcionan con cualquier distribución.
- 👁️ **Vista**: `V` alterna entre normal, con la dirección bajo el título y compacta.
- ⚙️ **Configuración**: carpeta inicial, abrir los marcadores en una pestaña nueva, marcadores como pestañas fijas,
  cerrar el panel cuando el foco pasa a la página.
- 🌍 **10 idiomas** con escritura de derecha a izquierda; la ayuda integrada (`i`) describe todos los flujos.

## Instalación

**Desde GitHub Release**

1. Descarga `airnook-bookmarks-<versión>.zip` de la [última versión](https://github.com/Airnook/bookmarks/releases/latest).
2. Descomprime el archivo en una carpeta permanente: el navegador lee la extensión desde allí.
3. Abre `chrome://extensions` y activa el «Modo de desarrollador».
4. Pulsa «Cargar descomprimida» y elige la carpeta con `manifest.json`.
5. Para actualizar, sustituye los archivos en la misma carpeta y pulsa «Volver a cargar» en la tarjeta de la extensión.

**Chrome Web Store**: próximamente.

Se necesita Chromium 141 o posterior.

## Inicio rápido

1. `Alt+B`: abrir el panel. Púlsalo otra vez para cerrarlo; si el foco pasó a la página, el mismo atajo lo devuelve al
   panel. El icono de la extensión también abre el panel: fíjalo en el menú de extensiones del navegador.
2. `↑` `↓`: moverse por la lista, `→` `←`: expandir y contraer una carpeta, `Enter`: abrir.
3. `/`: buscar; empieza a escribir un título, un sitio o una carpeta.
4. `Espacio`: seleccionar varios marcadores, `M`: moverlos a una carpeta por su nombre.
5. `⌘K`/`Ctrl+K`: paleta de comandos, con todos los comandos y sus teclas.
6. Clic derecho en un marcador, una carpeta o un espacio vacío: un menú como el del navegador; `Shift+F10`: lo mismo
   con el teclado.
7. `i`: ayuda. Los marcadores nuevos se añaden como siempre en el navegador: `⌘D`/`Ctrl+D`.

## Teclas predeterminadas

`⌘` es `Ctrl` en Windows y Linux. Cualquier tecla se puede cambiar en la configuración.

| Acción | Teclas |
| --- | --- |
| Moverse por la lista / expandir, contraer carpeta | `↑` `↓` / `→` `←`, `Home` `End` |
| Abrir / abrir en otra pestaña | `Enter` / `⌘Enter` |
| Devolver la pestaña a la dirección del marcador | `Shift+Enter` |
| Buscar marcadores | `/`, `⌘F` |
| Paleta de comandos | `⌘K`, `?` |
| Abrir menú | `Shift+F10` |
| Seleccionar / seguidos / seleccionar todo en la carpeta | `Espacio` / `Shift+↑↓` / `⌘A` |
| Mover a la carpeta… / mover arriba, abajo | `M` / `Alt+↑↓` |
| Carpeta nueva, cambiar nombre, eliminar | `N`, `R` (`F2`), `D` |
| Copiar dirección / guardar la dirección de la pestaña | `C` / `U` |
| Cortar, copiar, pegar | `⌘X`, `⌘C`, `⌘V` |
| Deshacer / rehacer | `⌘Z` / `⌘⇧Z`, `⌘Y` |
| Cerrar la pestaña del marcador | `⌫`, `Delete` |
| Cambiar vista / ayuda / configuración | `V` / `i` (`F1`) / `,` |
| Cancelar o cerrar: quitar la selección, salir de la búsqueda, cerrar el panel | `Esc` |

## Privacidad

La extensión funciona solo de forma local y no envía nada a la red: ni tus marcadores ni tu historial salen del
navegador. La configuración se guarda en el almacenamiento local de la extensión en el navegador. Los permisos son para
los marcadores, el panel lateral, los iconos de los sitios, las pestañas y los grupos de pestañas (modo de pestañas
fijas y apertura de conjuntos) y para guardar la configuración.

## Traducciones

La interfaz y la ayuda siguen el idioma del navegador: English, Русский, Español, Português (Brasil), Français, Deutsch,
中文（简体）, 日本語, हिन्दी, العربية. Para otros idiomas se usa el inglés.

¿Quieres añadir tu idioma o corregir una traducción? Consulta [TRANSLATING.md](TRANSLATING.md) (en inglés) o abre una
[issue «Translation»](https://github.com/Airnook/bookmarks/issues/new?template=translation.yml).

## Desarrollo

JavaScript puro (Manifest V3) sin compilación: el navegador carga los archivos de la raíz del repositorio tal cual.

```sh
npm ci
npm run lint
npm test
npm run test:browser   # prueba de humo en Chromium: npx playwright install chromium
npm run package        # dist/airnook-bookmarks-<versión>.zip
```

La arquitectura, las pruebas y la publicación de versiones se describen en [CONTRIBUTING.md](CONTRIBUTING.md).

## Licencia

[MIT](../../LICENSE) © 2026 Airnook
