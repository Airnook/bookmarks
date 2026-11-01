# Contributing

**🇬🇧 English** | [🇷🇺 Русский](../docs/ru/CONTRIBUTING.md) | [🇪🇸 Español](../docs/es/CONTRIBUTING.md) | [🇧🇷 Português (Brasil)](../docs/pt-BR/CONTRIBUTING.md) | [🇫🇷 Français](../docs/fr/CONTRIBUTING.md) | [🇩🇪 Deutsch](../docs/de/CONTRIBUTING.md) | [🇨🇳 中文（简体）](../docs/zh-CN/CONTRIBUTING.md) | [🇯🇵 日本語](../docs/ja/CONTRIBUTING.md) | [🇮🇳 हिन्दी](../docs/hi/CONTRIBUTING.md) | [🇸🇦 العربية](../docs/ar/CONTRIBUTING.md)

The extension is plain JavaScript (Manifest V3) without a build step: the browser loads the files from the repository
root as they are. The pages (`panel.html`, `options.html`, `help.html`) load ES modules (`<script type="module">`) with
explicit imports; what they share lives in `commands.js`. The background script `background.js` is a regular service
worker, not a module. The panel code is split into modules in `panel/`; startup and the order of event subscriptions
are in `panel/main.js`, shared mutable state is in `panel/state.js`. Interface text lives in
`_locales/<language>/messages.json` (standard `chrome.i18n`) and is shown by `i18n.js` (`t`, plurals, page direction).
Development tools (`package.json`, `eslint.config.js`, `test/`, `scripts/`) are not part of the release.

### Panel modules

Modules in `panel/` import each other only top-down, with no cycles — `test/panel-imports.test.js` checks this (and
prints the cycle path if there is one). Layers, from the bottom up:

1. no panel dependencies: `util`, `dom`, `url`, `search`, `place` (where a moved item lands), then `state`, `nodes`,
   `history` (edit history for undo and redo: every bookmark change made from the panel goes through its `begin()`);
2. `ui` (confirmation dialog, messages, focus), `keymap` (key hints), `tree` (reading the tree, node cache);
3. `search-index` (search index), `tabs`, `marks`;
4. `render`, then `find` (entering and leaving search), `open`, `edit`, `palette` (picking from a list);
5. `move-to`, `link`, `search-input`;
6. `actions` (what each command does);
7. `keys`, `mouse`, `drag` (mouse drag and drop), then `main`.

A module imports only from layers below it. When a lower module needs to call a higher one, it does not import it but
receives the call from outside: `tree` calls `onTreeApplied(callback)` after every tree read (`main.js` sets the
redraw), `openPalette(run)` runs the chosen command through the `run` it is given. State needed by several layers lives
in `state` (for example, `state.pending` — a key sequence in progress: `keys` drives it, and `palette` cancels it too).
There is no event bus: a callback is set explicitly, in one place, at startup. `main.js` defines the order of event
subscriptions, and it matters where several handlers listen to the same event.

## Development

Node.js 20.19+, 22.13+ or 24+ is required (an ESLint 10 requirement).

```sh
npm ci            # install dependencies
npm run lint      # ESLint
npm test          # tests (node --test)
npm run package   # build dist/airnook-bookmarks-<version>.zip and check the archive
npm run test:browser  # smoke test in Chromium (needs npx playwright install chromium)
```

To run the extension: `chrome://extensions` → “Developer mode” → “Load unpacked” → the repository root.

### Linter

The pages are ES modules: anything a file takes from another one (`COMMANDS`, `chordOf` from `commands.js` and so on)
it imports explicitly, otherwise the linter reports an unknown name. The linter does not allow an empty `catch {}`:
write inside it why the error can be ignored.

### Tests

Tests import modules without DOM (`commands.js`, pure panel functions in `panel/`) directly. `background.js` is not a
module, so tests load it through `node:vm` with a `chrome` stub (see `test/load.js`); the options page is loaded through
`node:vm` with DOM stubs too (see `test/options-page.js`).

`npm run test:browser` builds the archive, loads the extension into Playwright’s Chromium and checks the pages and the
main panel keys: a run for every language in `_locales/`, plus Hebrew without a translation and a fake right-to-left
Hebrew. Only some languages: `SMOKE_LOCALES=ru,en npm run test:browser` (names are `_locales` folders, `he`, `he-rtl`).
It is not part of `npm test` or CI: there may be no browser there.

### Packaging

The archive contents are a closure of references: `manifest.json` → everything it references (service worker, pages,
icons) → for every html page its `<script src>`, `<link href>` and `<img src>`, for every script its static `import`
and `export … from` → recursively. Plus the `_locales/` folder, if present, and the pages from `EXTRA_PAGES` in
`scripts/package.mjs`: the code opens them by name (for example, `help.html`), so references can’t find them. Nothing
else, including any new auxiliary files in the root, goes into the archive.

If extension `.js` gets a reference to a new html page that is not in the archive, the build fails with a hint to add
it to `EXTRA_PAGES`. After the build, a separate check makes sure the archive has no `package.json`, linter configs,
`test/`, `scripts/`, `.github/`, `README*.md`, `docs/` (README images), `LICENSE`, `TODO.md`, `CONTRIBUTING*.md` or
hidden files, and that all references are in place; on error the command exits with a non-zero code.

CI (`.github/workflows/ci.yml`) does the same on every push and pull request to `dev` and `main`.

## Translations

The interface translation lives in `_locales/<language>/messages.json`. How to add a language or fix a translation, and
what `npm test` checks, is in [TRANSLATING.md](TRANSLATING.md). A new folder in `_locales/` is picked up automatically;
no code changes are needed.

## Releasing

1. Bump `version` in `manifest.json` and merge the change into `main`.
2. On `main`, create the tag `vX.Y.Z`, where `X.Y.Z` is exactly the version from `manifest.json`:

   ```sh
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. The `release.yml` workflow checks that the tag matches the version, runs lint and tests, builds the archive and
   publishes a GitHub Release with `airnook-bookmarks-X.Y.Z.zip`.

If the tag and the version don’t match, the workflow fails before the build: delete the tag
(`git push --delete origin vX.Y.Z`), fix the version and try again.
