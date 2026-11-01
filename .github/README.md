# Airnook Bookmarks

**🇬🇧 English** | [🇷🇺 Русский](../docs/ru/README.md) | [🇪🇸 Español](../docs/es/README.md) | [🇧🇷 Português (Brasil)](../docs/pt-BR/README.md) | [🇫🇷 Français](../docs/fr/README.md) | [🇩🇪 Deutsch](../docs/de/README.md) | [🇨🇳 中文（简体）](../docs/zh-CN/README.md) | [🇯🇵 日本語](../docs/ja/README.md) | [🇮🇳 हिन्दी](../docs/hi/README.md) | [🇸🇦 العربية](../docs/ar/README.md)

[![CI](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml/badge.svg)](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/Airnook/bookmarks)](https://github.com/Airnook/bookmarks/releases/latest)
[![Chromium 141+](https://img.shields.io/badge/Chromium-141%2B-4285F4?logo=googlechrome&logoColor=white)](https://www.chromium.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![10 languages](https://img.shields.io/badge/languages-10-orange)](TRANSLATING.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](../LICENSE)

**Bookmarks** is an extension for Chromium browsers (Chrome, Edge, Brave, Arc, Helium and others): your bookmarks in
the side panel, next to the page, all from the keyboard. Find, open, sort into folders, keep bookmarks as pinned tabs.
Made when moving from Arc to a Chromium browser: its side panel was missed.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../docs/panel-dark.png">
    <img src="../docs/panel-light.png" alt="The Bookmarks side panel: a folder tree with two marked bookmarks" width="360">
  </picture>
</p>

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Default keys](#default-keys)
- [Privacy](#privacy)
- [Translations](#translations)
- [Development](#development)
- [License](#license)

## Features

- ⌨️ **One shortcut for the panel**: `Alt+B` (`⌥B` on Mac) opens the panel, brings focus back from the page and closes
  it. You can change it at `chrome://extensions/shortcuts`.
- 📌 **Bookmarks as pinned tabs**, like in Arc: a dot on bookmarks with an open tab (and a ring on a collapsed folder
  with something open inside). Opening a bookmark again switches to its tab, `Shift+Enter` returns the tab to the
  bookmark’s address, `U` saves the current address in the bookmark. The mode can be turned off in settings.
- 🔎 **Search**: `/` or `⌘F`/`Ctrl+F`, by title, address and folder, with highlighting. `Tab` shows the match in place
  in the tree.
- 🗂️ **Sort out bookmarks**: marks (`Space`, `Shift+↑↓`, `⌘A`), move to a folder by name (`M`, recent folders first,
  creates the folder if there is none), move along the list (`Alt+↑↓`), new folder (`N`), rename (`R`), delete (`D`),
  copy addresses (`C`).
- ↩️ **Undo and redo** (new in 2.6): `⌘Z` / `⌘⇧Z` on Mac, `Ctrl+Z` and `Ctrl+Shift+Z` or `Ctrl+Y` elsewhere, or the
  “Undo” button in the message. A deleted folder comes back with its contents. The history keeps 50 steps and is shared
  by all windows until the browser is closed.
- 🖱️ **Drag and drop** (new in 2.6): drag bookmarks, folders and marked items above, below or into a folder. A folder
  opens when you hold an item over it, and the list scrolls near the edge.
- 📋 **Right-click menu** (new in 2.6), like the browser’s bookmark menu: open in a new tab, new window, split view or
  Incognito window; edit; cut, copy and paste; delete; add a page or folder; open the bookmarks manager. `Shift+F10`
  opens it from the keyboard.
- 📂 **Open as a set**: marked bookmarks or a whole folder, as a tab group with a name or as regular tabs. Tabs that are
  already open aren’t duplicated.
- 🎛️ **Command palette**: `⌘K`/`Ctrl+K` or `?` — all commands with their keys.
- 🔧 **Your own keys**: any command can be remapped in settings. There is a Vim preset, sequences (`G G`) and double
  presses. Keys are matched by position, so they work on any keyboard layout.
- 👁️ **View**: `V` switches between normal, with the address under the title, and compact.
- ⚙️ **Settings**: start folder, open bookmarks in a new tab, bookmarks as pinned tabs, close the panel when focus moves
  to the page.
- 🌍 **10 languages** with right-to-left support; the built-in help (`i`) describes every workflow.

## Installation

**From GitHub Release**

1. Download `airnook-bookmarks-<version>.zip` from the [latest release](https://github.com/Airnook/bookmarks/releases/latest).
2. Unpack the archive into a permanent folder: the browser reads the extension from there.
3. Open `chrome://extensions` and turn on “Developer mode”.
4. Click “Load unpacked” and pick the folder with `manifest.json`.
5. To update, replace the files in the same folder and press “Reload” on the extension card.

**Chrome Web Store**: coming soon.

Chromium 141 or newer is required.

## Quick start

1. `Alt+B` — open the panel. Press again to close it; if focus moved to the page, the same shortcut brings it back to
   the panel. The extension icon also opens the panel — pin it in the browser’s extensions menu.
2. `↑` `↓` — move through the list, `→` `←` — expand and collapse a folder, `Enter` — open.
3. `/` — search: start typing a title, site or folder.
4. `Space` — mark several bookmarks, `M` — move them to a folder by name.
5. `⌘K`/`Ctrl+K` — command palette: all commands with their keys.
6. Right-click a bookmark, a folder or an empty spot for a menu like the browser’s; `Shift+F10` — the same from the
   keyboard.
7. `i` — help. New bookmarks are added the usual browser way — `⌘D`/`Ctrl+D`.

## Default keys

`⌘` is `Ctrl` on Windows and Linux. Any key can be changed in settings.

| Action | Keys |
| --- | --- |
| Move through the list / expand, collapse a folder | `↑` `↓` / `→` `←`, `Home` `End` |
| Open / open in other tab | `Enter` / `⌘Enter` |
| Return tab to bookmark address | `Shift+Enter` |
| Search bookmarks | `/`, `⌘F` |
| Command palette | `⌘K`, `?` |
| Open menu | `Shift+F10` |
| Mark / in a run / mark all in folder | `Space` / `Shift+↑↓` / `⌘A` |
| Move to folder… / move up, down | `M` / `Alt+↑↓` |
| New folder, rename, delete | `N`, `R` (`F2`), `D` |
| Copy address / save tab address | `C` / `U` |
| Cut, copy, paste | `⌘X`, `⌘C`, `⌘V` |
| Undo / redo | `⌘Z` / `⌘⇧Z`, `⌘Y` |
| Close bookmark’s tab | `⌫`, `Delete` |
| Change view / help / settings | `V` / `i` (`F1`) / `,` |
| Cancel or close: clear marks, leave search, close the panel | `Esc` |

## Privacy

The extension works locally only and sends nothing over the network: neither your bookmarks nor your history leave the
browser. Settings are kept in the browser’s local extension storage. Permissions are needed for bookmarks, the side
panel, site icons, tabs and tab groups (pinned-tabs mode and opening sets) and for storing settings.

## Translations

The interface and the help follow the browser language: English, Русский, Español, Português (Brasil), Français,
Deutsch, 中文（简体）, 日本語, हिन्दी, العربية. Other languages fall back to English.

Want to add your language or fix a translation? See [TRANSLATING.md](TRANSLATING.md) or open a
[Translation issue](https://github.com/Airnook/bookmarks/issues/new?template=translation.yml).

## Development

Plain JavaScript (Manifest V3) without a build step: the browser loads the files from the repository root as they are.

```sh
npm ci
npm run lint
npm test
npm run test:browser   # smoke test in Chromium: npx playwright install chromium
npm run package        # dist/airnook-bookmarks-<version>.zip
```

Architecture, tests and the release process are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](../LICENSE) © 2026 Airnook
