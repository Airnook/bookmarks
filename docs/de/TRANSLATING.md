# Bookmarks übersetzen

[🇬🇧 English](../../.github/TRANSLATING.md) | [🇷🇺 Русский](../ru/TRANSLATING.md) | [🇪🇸 Español](../es/TRANSLATING.md) | [🇧🇷 Português (Brasil)](../pt-BR/TRANSLATING.md) | [🇫🇷 Français](../fr/TRANSLATING.md) | **🇩🇪 Deutsch** | [🇨🇳 中文（简体）](../zh-CN/TRANSLATING.md) | [🇯🇵 日本語](../ja/TRANSLATING.md) | [🇮🇳 हिन्दी](../hi/TRANSLATING.md) | [🇸🇦 العربية](../ar/TRANSLATING.md)

Die Texte der Oberfläche liegen in `_locales/<code>/messages.json` (das Standardformat `chrome.i18n` von Chrome).
Diese Anleitung behandelt nur diese Datei. Chrome wählt den Ordner, der zur Sprache des Browsers passt;
gibt es keinen, wird der englische Text (`_locales/en`) verwendet.

## Eine neue Sprache hinzufügen

1. Wählen Sie einen Code aus der [Chrome-Liste der Locales](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
   Chrome ignoriert Codes, die es nicht unterstützt. Verwenden Sie im Ordnernamen einen Unterstrich: `pt_BR`, `zh_CN`, `es_419`.
2. Kopieren Sie `_locales/en/messages.json` nach `_locales/<code>/messages.json`.
3. Setzen Sie `locale` auf denselben Code, aber mit Bindestrich: `pt-BR`, `zh-CN`, `es-419`.
4. Setzen Sie `dir` auf `ltr` oder `rtl`.
5. Übersetzen Sie jede `message` und führen Sie dann die Prüfungen unten aus.

Code muss nicht geändert werden: Die Tests finden alle Ordner in `_locales/` selbst.

## Schlüssel und Felder

- **Ändern Sie nie einen Schlüssel** (den Namen vor `"message"`). Der Code verwendet diese Namen.
- **`message`** — der Text, den Sie übersetzen.
- **`description`** — Kontext für Übersetzer, zum Beispiel wo der Text erscheint. Er wird in der Erweiterung nicht angezeigt.
  In `en` braucht jede Nachricht mit `placeholders` eine, auch jede Pluralform (`_one`, `_other`…): Geben Sie an, wo der Text erscheint und was jedes `$NAME$` ist.
  `npm test` prüft das. Andere Sprachen dürfen sie weglassen.
- **`locale`** — der Sprachcode der Datei. Pluralformen und das `lang` der Seite leiten sich davon ab.
- **`dir`** — `ltr` (von links nach rechts) oder `rtl` (von rechts nach links, zum Beispiel Arabisch, Hebräisch, Persisch, Urdu).
  Die Seiten übernehmen ihre Richtung daraus.

## Platzhalter

`$NAME$` in einer `message` wird durch den Wert des Platzhalters mit diesem Namen ersetzt.
Behalten Sie den Namen und die `$`-Zeichen bei und setzen Sie den Platzhalter dorthin, wo Ihre Sprache ihn braucht:

```json
"more_results": {
  "message": "$COUNT$ more — refine the search",
  "placeholders": {
    "count": { "content": "$1" }
  }
}
```

- Verwenden Sie dieselben Platzhalternamen wie in `en`. `content` bleibt `$1`, `$2`… wie in `en`.
- Übersetzen Sie keinen Text innerhalb von `$…$`.
- Schreiben Sie `$$` für ein echtes Dollarzeichen.

## Pluralformen

Eine Nachricht mit einer Zahl hat pro CLDR-Pluralkategorie einen Schlüssel: `<key>_one`, `<key>_few`, `<key>_many`, `<key>_other`.
Verwenden Sie die Kategorien Ihrer Sprache, und zwar alle: Die [CLDR-Pluralregeln](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
listen sie auf (Englisch hat `one` und `other`; Russisch hat `one`, `few`, `many`, `other`).
`npm test` schlägt fehl, wenn eine Kategorie fehlt, und nennt die fehlenden Schlüssel. `_other` ist Pflicht.
Lassen Sie neben den Formen keinen einfachen Schlüssel (`bookmarks`) stehen.

```json
"bookmarks_one": {
  "message": "$COUNT$ bookmark",
  "placeholders": { "count": { "content": "$1" } }
},
"bookmarks_other": {
  "message": "$COUNT$ bookmarks",
  "placeholders": { "count": { "content": "$1" } }
}
```

Russisch (`ru`) verwendet für denselben Schlüssel `bookmarks_one` („$COUNT$ закладка“), `_few` („$COUNT$ закладки“),
`_many` („$COUNT$ закладок“), `_other` („$COUNT$ закладки“).

## Wörter für die Befehlspalette (`cmd_*_words`)

Jeder Befehl hat `cmd_<id>` (seinen Namen), optional `cmd_<id>_note` (eine zweite Zeile) und `cmd_<id>_words`:
zusätzliche Suchwörter für die Palette in Ihrer Sprache, durch Leerzeichen getrennt.
Die englischen Suchwörter gelten immer mit, deshalb bleiben `cmd_*_words` in `en` leer.
Schlüssel mit leeren Werten sind erlaubt, aber alle müssen existieren.

```json
"cmd_search_words": {
  "message": "найти фильтр",
  "description": "Extra words to find the command in the palette, in your language; the English words always work"
}
```

## Lokal prüfen

Erfordert Node.js 20.19+, 22.13+ oder 24+ (CI verwendet 22).

```sh
npm ci            # install dependencies
npm test          # checks every language in _locales/
npm run lint
npm run package   # builds dist/*.zip; _locales/ is included
```

`npm test` prüft für jede Sprache:

- dieselben Schlüssel wie in `en` (keine fehlenden und keine überzähligen; Pluralformen zählen als ein Schlüssel);
- `locale` und `dir` sind gesetzt, und `locale` entspricht dem Ordnernamen;
- Pluralformen: Jede Kategorie der Sprache ist vorhanden, keine weiteren, und `_other` existiert;
- Platzhalter stimmen mit `en` überein, und jedes `content` ist `$1`…`$9`;
- `en` hat für jede Nachricht mit Platzhaltern eine `description`;
- jeder Schlüssel, den der Code verwendet, existiert in `en`.

Um die Oberfläche in Ihrer Sprache zu sehen, laden Sie die entpackte Erweiterung in einem Browser mit dieser Sprache:

1. Stellen Sie die Oberflächensprache des Browsers auf Ihre ein (Chrome: Einstellungen → Sprachen; Browser neu starten).
2. Öffnen Sie `chrome://extensions`, aktivieren Sie den „Entwicklermodus“ („Developer mode“), klicken Sie auf „Entpackte Erweiterung laden“ („Load unpacked“) und wählen Sie das Repository-Stammverzeichnis.
3. Öffnen Sie die Seitenleiste und prüfen Sie die Texte, die Pluralformen und bei `rtl` das Layout.

`npm run test:browser` (erfordert `npx playwright install chromium`) öffnet die Seiten Hilfe, Einstellungen und Seitenleiste in einem echten Browser,
einmal für jeden Sprachordner in `_locales/`, einmal für Hebräisch (keine Übersetzung, also englischer Text) und einmal für ein erfundenes Hebräisch von rechts nach links.
Prüfen Sie während der Arbeit nur Ihre Sprache: `SMOKE_LOCALES=pt_BR npm run test:browser` (Namen durch Kommas getrennt: Ordnernamen, `he`, `he-rtl`).

## Eine vorhandene Übersetzung aktualisieren

Wenn `en` neue Schlüssel bekommt oder sich ändert, schlägt `npm test` fehl und listet die in jeder Sprache fehlenden Schlüssel auf.
Fügen Sie sie hinzu, übersetzen Sie sie und führen Sie `npm test` erneut aus. Entfernen Sie Schlüssel, die es in `en` nicht mehr gibt.

## Einen Pull Request öffnen

1. Erstellen Sie einen Branch von `dev` und committen Sie `_locales/<code>/messages.json`.
2. Führen Sie die Prüfungen oben aus.
3. Öffnen Sie einen Pull Request nach `dev` (`gh pr create --base dev` oder auf GitHub).
   Nennen Sie in der Beschreibung, um welche Sprache es geht und ob sie neu ist oder es eine Korrektur ist.
   Fragen und Probleme: Öffnen Sie ein Issue mit dem Formular **Translation**.
