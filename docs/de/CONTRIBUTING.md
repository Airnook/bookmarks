# Mitwirken

[🇬🇧 English](../../.github/CONTRIBUTING.md) | [🇷🇺 Русский](../ru/CONTRIBUTING.md) | [🇪🇸 Español](../es/CONTRIBUTING.md) | [🇧🇷 Português (Brasil)](../pt-BR/CONTRIBUTING.md) | [🇫🇷 Français](../fr/CONTRIBUTING.md) | **🇩🇪 Deutsch** | [🇨🇳 中文（简体）](../zh-CN/CONTRIBUTING.md) | [🇯🇵 日本語](../ja/CONTRIBUTING.md) | [🇮🇳 हिन्दी](../hi/CONTRIBUTING.md) | [🇸🇦 العربية](../ar/CONTRIBUTING.md)

Die Erweiterung ist reines JavaScript (Manifest V3) ohne Build-Schritt: Der Browser lädt die Dateien aus dem
Stammverzeichnis des Repositorys unverändert. Die Seiten (`panel.html`, `options.html`, `help.html`) laden ES-Module
(`<script type="module">`) mit expliziten Imports; was sie gemeinsam nutzen, liegt in `commands.js`. Das Hintergrundskript
`background.js` ist ein gewöhnlicher Service Worker, kein Modul. Der Code der Seitenleiste ist in Module in `panel/`
aufgeteilt; Start und Reihenfolge der Ereignisabonnements stehen in `panel/main.js`, der gemeinsame veränderliche Zustand
in `panel/state.js`. Der Oberflächentext liegt in `_locales/<Sprache>/messages.json` (Standard-`chrome.i18n`) und wird von
`i18n.js` angezeigt (`t`, Plurale, Seitenrichtung). Die Entwicklungswerkzeuge (`package.json`, `eslint.config.js`,
`test/`, `scripts/`) gehören nicht zum Release.

### Module der Seitenleiste

Die Module in `panel/` importieren einander nur von oben nach unten, ohne Zyklen — das prüft `test/panel-imports.test.js`
(und gibt den Zyklus-Pfad aus, falls es einen gibt). Die Schichten, von unten nach oben:

1. ohne Abhängigkeiten innerhalb der Seitenleiste: `util`, `dom`, `url`, `search`, `place` (wohin ein verschobenes Element
   gelangt), dann `state`, `nodes`, `history` (Bearbeitungsverlauf für Rückgängig und Wiederholen: Jede Änderung an
   Lesezeichen aus der Seitenleiste läuft über sein `begin()`);
2. `ui` (Bestätigungsdialog, Meldungen, Fokus), `keymap` (Tastenhinweise), `tree` (Lesen des Baums, Knoten-Cache);
3. `search-index` (Suchindex), `tabs`, `marks`;
4. `render`, dann `find` (Suche betreten und verlassen), `open`, `edit`, `palette` (Auswahl aus einer Liste);
5. `move-to`, `link`, `search-input`;
6. `actions` (was jeder Befehl tut);
7. `keys`, `mouse`, `drag` (Drag and Drop mit der Maus), dann `main`.

Ein Modul importiert nur aus tieferen Schichten. Muss ein tieferes Modul ein höheres aufrufen, importiert es dieses nicht,
sondern bekommt den Aufruf von außen: `tree` ruft nach jedem Lesen des Baums `onTreeApplied(callback)` auf (`main.js`
setzt das Neuzeichnen), `openPalette(run)` führt den gewählten Befehl über das übergebene `run` aus. Zustand, den mehrere
Schichten brauchen, liegt in `state` (zum Beispiel `state.pending` — eine laufende Tastenfolge: `keys` steuert sie, und
`palette` bricht sie ebenfalls ab). Es gibt keinen Event-Bus: Ein Callback wird ausdrücklich an einer Stelle beim Start
gesetzt. `main.js` legt die Reihenfolge der Ereignisabonnements fest, und sie ist wichtig, wenn mehrere Handler auf
dasselbe Ereignis hören.

## Entwicklung

Erforderlich ist Node.js 20.19+, 22.13+ oder 24+ (eine Anforderung von ESLint 10).

```sh
npm ci            # install dependencies
npm run lint      # ESLint
npm test          # tests (node --test)
npm run package   # build dist/airnook-bookmarks-<version>.zip and check the archive
npm run test:browser  # smoke test in Chromium (needs npx playwright install chromium)
```

Erweiterung starten: `chrome://extensions` → „Entwicklermodus“ → „Entpackte Erweiterung laden“ → das Stammverzeichnis des Repositorys.

### Linter

Die Seiten sind ES-Module: Alles, was eine Datei aus einer anderen verwendet (`COMMANDS`, `chordOf` aus `commands.js`
und so weiter), importiert sie ausdrücklich, sonst meldet der Linter einen unbekannten Namen. Der Linter erlaubt kein
leeres `catch {}`: Schreiben Sie hinein, warum der Fehler ignoriert werden darf.

### Tests

Tests importieren Module ohne DOM (`commands.js`, reine Funktionen der Seitenleiste in `panel/`) direkt. `background.js`
ist kein Modul, deshalb laden die Tests es über `node:vm` mit einem `chrome`-Stub (siehe `test/load.js`); die
Optionsseite wird ebenfalls über `node:vm` mit DOM-Stubs geladen (siehe `test/options-page.js`).

`npm run test:browser` baut das Archiv, lädt die Erweiterung in das Chromium von Playwright und prüft die Seiten und die
wichtigsten Tasten der Seitenleiste: ein Lauf für jede Sprache in `_locales/`, dazu Hebräisch ohne Übersetzung und ein
erfundenes Hebräisch von rechts nach links. Nur einige Sprachen: `SMOKE_LOCALES=ru,en npm run test:browser` (die Namen
sind Ordner in `_locales`, `he`, `he-rtl`). Der Test gehört nicht zu `npm test` oder CI: Dort gibt es womöglich keinen Browser.

### Paketierung

Der Inhalt des Archivs ist ein Abschluss über Verweise: `manifest.json` → alles, worauf es verweist (Service Worker,
Seiten, Symbole) → für jede HTML-Seite ihre `<script src>`, `<link href>` und `<img src>`, für jedes Skript seine
statischen `import` und `export … from` → rekursiv. Dazu der Ordner `_locales/`, falls vorhanden, und die Seiten aus
`EXTRA_PAGES` in `scripts/package.mjs`: Der Code öffnet sie über den Namen (zum Beispiel `help.html`), daher finden
Verweise sie nicht. Sonst nichts, auch keine neuen Hilfsdateien im Stammverzeichnis, gelangt ins Archiv.

Bekommt ein `.js` der Erweiterung einen Verweis auf eine neue HTML-Seite, die nicht im Archiv ist, schlägt der Build mit
dem Hinweis fehl, sie in `EXTRA_PAGES` aufzunehmen. Nach dem Build stellt eine separate Prüfung sicher, dass das Archiv
kein `package.json`, keine Linter-Konfigurationen, kein `test/`, `scripts/`, `.github/`, `README*.md`, `docs/`
(Bilder der README), `LICENSE`, `TODO.md`, `CONTRIBUTING*.md` und keine versteckten Dateien enthält und dass alle Verweise
vorhanden sind; bei einem Fehler endet der Befehl mit einem Exit-Code ungleich null.

CI (`.github/workflows/ci.yml`) macht dasselbe bei jedem Push und Pull Request nach `dev` und `main`.

## Übersetzungen

Die Übersetzung der Oberfläche liegt in `_locales/<Sprache>/messages.json`. Wie man eine Sprache hinzufügt oder eine
Übersetzung korrigiert und was `npm test` prüft, steht in [TRANSLATING.md](TRANSLATING.md). Ein neuer Ordner in
`_locales/` wird automatisch erkannt; Codeänderungen sind nicht nötig.

## Release

1. Erhöhen Sie `version` in `manifest.json` und mergen Sie die Änderung in `main`.
2. Erstellen Sie auf `main` den Tag `vX.Y.Z`, wobei `X.Y.Z` genau die Version aus `manifest.json` ist:

   ```sh
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. Der Workflow `release.yml` prüft, ob der Tag zur Version passt, führt Lint und Tests aus, baut das Archiv und
   veröffentlicht ein GitHub Release mit `airnook-bookmarks-X.Y.Z.zip`.

Passen Tag und Version nicht zusammen, schlägt der Workflow vor dem Build fehl: Löschen Sie den Tag
(`git push --delete origin vX.Y.Z`), korrigieren Sie die Version und versuchen Sie es erneut.
