# Translating Bookmarks

**🇬🇧 English** | [🇷🇺 Русский](../docs/ru/TRANSLATING.md) | [🇪🇸 Español](../docs/es/TRANSLATING.md) | [🇧🇷 Português (Brasil)](../docs/pt-BR/TRANSLATING.md) | [🇫🇷 Français](../docs/fr/TRANSLATING.md) | [🇩🇪 Deutsch](../docs/de/TRANSLATING.md) | [🇨🇳 中文（简体）](../docs/zh-CN/TRANSLATING.md) | [🇯🇵 日本語](../docs/ja/TRANSLATING.md) | [🇮🇳 हिन्दी](../docs/hi/TRANSLATING.md) | [🇸🇦 العربية](../docs/ar/TRANSLATING.md)

The interface text lives in `_locales/<code>/messages.json` (Chrome's standard `chrome.i18n` format).
This guide covers that file only. Chrome picks the folder that matches the browser's language;
if there is none, the English text (`_locales/en`) is used.

## Add a new language

1. Pick a code from the [Chrome locale list](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
   Chrome ignores codes it does not support. Use an underscore in the folder name: `pt_BR`, `zh_CN`, `es_419`.
2. Copy `_locales/en/messages.json` to `_locales/<code>/messages.json`.
3. Set `locale` to the same code with a hyphen: `pt-BR`, `zh-CN`, `es-419`.
4. Set `dir` to `ltr` or `rtl`.
5. Translate every `message`, then run the checks below.

No code changes are needed: the tests find every folder in `_locales/` by themselves.

## Keys and fields

- **Never change a key** (the name before `"message"`). The code uses the names.
- **`message`** — the text you translate.
- **`description`** — context for translators, for example where the text appears. It is not shown in the extension.
  In `en` every message with `placeholders` needs one, including every plural form (`_one`, `_other`…): say where the text shows and what each `$NAME$` is.
  `npm test` checks this. Other languages may leave it out.
- **`locale`** — the language code of the file. Plural forms and the page `lang` come from it.
- **`dir`** — `ltr` (left to right) or `rtl` (right to left, for example Arabic, Hebrew, Persian, Urdu).
  The pages take their direction from it.

## Placeholders

`$NAME$` in a `message` is replaced by the value of the placeholder with that name.
Keep the name and the `$` signs, and move the placeholder to where your language needs it:

```json
"more_results": {
  "message": "$COUNT$ more — refine the search",
  "placeholders": {
    "count": { "content": "$1" }
  }
}
```

- Use the same placeholder names as in `en`. `content` stays `$1`, `$2`… as in `en`.
- Do not translate text inside `$…$`.
- Write `$$` for a literal dollar sign.

## Plural forms

A message with a number has one key per CLDR plural category: `<key>_one`, `<key>_few`, `<key>_many`, `<key>_other`.
Use the categories your language has, and all of them: the [CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
list them (English has `one` and `other`; Russian has `one`, `few`, `many`, `other`).
`npm test` fails if a category is missing and names the missing keys. `_other` is required.
Do not keep a plain key (`bookmarks`) next to the forms.

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

Russian (`ru`) for the same key uses `bookmarks_one` ("$COUNT$ закладка"), `_few` ("$COUNT$ закладки"),
`_many` ("$COUNT$ закладок"), `_other` ("$COUNT$ закладки").

## Command palette words (`cmd_*_words`)

Each command has `cmd_<id>` (its name), optionally `cmd_<id>_note` (a second line), and `cmd_<id>_words`:
extra words for searching the palette, separated by spaces, in your language.
The English search words are always used too, so `cmd_*_words` in `en` stay empty.
Keys with empty values are allowed, but all of them must exist.

```json
"cmd_search_words": {
  "message": "найти фильтр",
  "description": "Extra words to find the command in the palette, in your language; the English words always work"
}
```

## Check locally

Needs Node.js 20.19+, 22.13+ or 24+ (CI uses 22).

```sh
npm ci            # install dependencies
npm test          # checks every language in _locales/
npm run lint
npm run package   # builds dist/*.zip; _locales/ is included
```

`npm test` checks, for every language:

- the same keys as `en` (no missing and no extra ones; plural forms count as one key);
- `locale` and `dir` are set, and `locale` matches the folder name;
- plural forms: every category of the language is present, no others, and `_other` exists;
- placeholders match `en`, and each `content` is `$1`…`$9`;
- `en` has a `description` for every message with placeholders;
- every key the code uses exists in `en`.

To see the interface in your language, load the unpacked extension in that language:

1. Set the browser's interface language to yours (Chrome: Settings → Languages; restart the browser).
2. Open `chrome://extensions`, turn on «Developer mode», click «Load unpacked» and choose the repository root.
3. Open the side panel and check the text, the plural forms and, for `rtl`, the layout.

`npm run test:browser` (needs `npx playwright install chromium`) opens the help, options and side panel pages in a real browser,
once for every language folder in `_locales/` and once for Hebrew (no translation, so English text) and once for a fake right-to-left Hebrew.
Check only your language while you work: `SMOKE_LOCALES=pt_BR npm run test:browser` (names separated by commas: folder names, `he`, `he-rtl`).

## Update an existing translation

When `en` gets new keys or changes, `npm test` fails and lists the keys that are missing in each language.
Add them, translate them, and run `npm test` again. Remove keys that are no longer in `en`.

## Open a pull request

1. Create a branch from `main`, commit `_locales/<code>/messages.json`.
2. Run the checks above.
3. Open a pull request into `main` (`gh pr create --base main`, or on GitHub).
   In the description, say which language and whether it is new or a fix.
   Questions and problems: open an issue with the **Translation** form.
