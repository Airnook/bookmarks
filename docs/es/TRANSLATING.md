# Traducir Bookmarks

[🇬🇧 English](../../.github/TRANSLATING.md) | [🇷🇺 Русский](../ru/TRANSLATING.md) | **🇪🇸 Español** | [🇧🇷 Português (Brasil)](../pt-BR/TRANSLATING.md) | [🇫🇷 Français](../fr/TRANSLATING.md) | [🇩🇪 Deutsch](../de/TRANSLATING.md) | [🇨🇳 中文（简体）](../zh-CN/TRANSLATING.md) | [🇯🇵 日本語](../ja/TRANSLATING.md) | [🇮🇳 हिन्दी](../hi/TRANSLATING.md) | [🇸🇦 العربية](../ar/TRANSLATING.md)

Los textos de la interfaz están en `_locales/<code>/messages.json` (el formato estándar `chrome.i18n` de Chrome).
Esta guía trata solo de ese archivo. Chrome elige la carpeta que coincide con el idioma del navegador;
si no hay ninguna, se usa el texto en inglés (`_locales/en`).

## Añadir un idioma nuevo

1. Elija un código de la [lista de configuraciones regionales de Chrome](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
   Chrome ignora los códigos que no admite. Use un guion bajo en el nombre de la carpeta: `pt_BR`, `zh_CN`, `es_419`.
2. Copie `_locales/en/messages.json` en `_locales/<code>/messages.json`.
3. Ponga en `locale` el mismo código con guion: `pt-BR`, `zh-CN`, `es-419`.
4. Ponga en `dir` el valor `ltr` o `rtl`.
5. Traduzca cada `message` y ejecute las comprobaciones de abajo.

No hace falta cambiar código: las pruebas encuentran solas todas las carpetas de `_locales/`.

## Claves y campos

- **No cambie nunca una clave** (el nombre antes de `"message"`). El código usa esos nombres.
- **`message`** — el texto que se traduce.
- **`description`** — contexto para traductores, por ejemplo dónde aparece el texto. No se muestra en la extensión.
  En `en`, cada mensaje con `placeholders` necesita una, incluida cada forma plural (`_one`, `_other`…): indique dónde se muestra el texto y qué es cada `$NAME$`.
  `npm test` lo comprueba. Los demás idiomas pueden omitirla.
- **`locale`** — el código de idioma del archivo. De él salen las formas plurales y el `lang` de la página.
- **`dir`** — `ltr` (de izquierda a derecha) o `rtl` (de derecha a izquierda, por ejemplo árabe, hebreo, persa, urdu).
  Las páginas toman de aquí su dirección.

## Marcadores de posición

`$NAME$` en un `message` se sustituye por el valor del marcador con ese nombre.
Conserve el nombre y los signos `$`, y coloque el marcador donde lo necesite su idioma:

```json
"more_results": {
  "message": "$COUNT$ more — refine the search",
  "placeholders": {
    "count": { "content": "$1" }
  }
}
```

- Use los mismos nombres de marcador que en `en`. `content` sigue siendo `$1`, `$2`… como en `en`.
- No traduzca el texto dentro de `$…$`.
- Escriba `$$` para un signo de dólar literal.

## Formas plurales

Un mensaje con un número tiene una clave por categoría plural de CLDR: `<key>_one`, `<key>_few`, `<key>_many`, `<key>_other`.
Use las categorías de su idioma, y todas: las [reglas plurales de CLDR](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
las enumeran (el inglés tiene `one` y `other`; el ruso tiene `one`, `few`, `many`, `other`).
`npm test` falla si falta una categoría y nombra las claves que faltan. `_other` es obligatoria.
No deje una clave simple (`bookmarks`) junto a las formas.

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

El ruso (`ru`) para la misma clave usa `bookmarks_one` («$COUNT$ закладка»), `_few` («$COUNT$ закладки»),
`_many` («$COUNT$ закладок»), `_other` («$COUNT$ закладки»).

## Palabras de la paleta de comandos (`cmd_*_words`)

Cada comando tiene `cmd_<id>` (su nombre), opcionalmente `cmd_<id>_note` (una segunda línea) y `cmd_<id>_words`:
palabras adicionales para buscar en la paleta, en su idioma, separadas por espacios.
Las palabras de búsqueda en inglés se usan siempre, por eso `cmd_*_words` en `en` quedan vacías.
Se permiten claves con valores vacíos, pero deben existir todas.

```json
"cmd_search_words": {
  "message": "найти фильтр",
  "description": "Extra words to find the command in the palette, in your language; the English words always work"
}
```

## Comprobar en local

Requiere Node.js 20.19+, 22.13+ o 24+ (CI usa 22).

```sh
npm ci            # install dependencies
npm test          # checks every language in _locales/
npm run lint
npm run package   # builds dist/*.zip; _locales/ is included
```

`npm test` comprueba, para cada idioma:

- las mismas claves que `en` (ni faltantes ni sobrantes; las formas plurales cuentan como una clave);
- `locale` y `dir` están definidos, y `locale` coincide con el nombre de la carpeta;
- formas plurales: está cada categoría del idioma, ninguna otra, y existe `_other`;
- los marcadores coinciden con `en`, y cada `content` es `$1`…`$9`;
- `en` tiene `description` para cada mensaje con marcadores;
- cada clave que usa el código existe en `en`.

Para ver la interfaz en su idioma, cargue la extensión descomprimida en un navegador con ese idioma:

1. Ponga el idioma de la interfaz del navegador en el suyo (Chrome: Configuración → Idiomas; reinicie el navegador).
2. Abra `chrome://extensions`, active el «Modo de desarrollador» («Developer mode»), pulse «Cargar descomprimida» («Load unpacked») y elija la raíz del repositorio.
3. Abra el panel lateral y revise los textos, las formas plurales y, para `rtl`, la disposición.

`npm run test:browser` (requiere `npx playwright install chromium`) abre las páginas de ayuda, opciones y panel lateral en un navegador real,
una vez por cada carpeta de idioma de `_locales/`, una vez para hebreo (sin traducción, así que texto en inglés) y una vez para un hebreo ficticio de derecha a izquierda.
Compruebe solo su idioma mientras trabaja: `SMOKE_LOCALES=pt_BR npm run test:browser` (nombres separados por comas: nombres de carpeta, `he`, `he-rtl`).

## Actualizar una traducción existente

Cuando `en` recibe claves nuevas o cambia, `npm test` falla y enumera las claves que faltan en cada idioma.
Añádalas, tradúzcalas y vuelva a ejecutar `npm test`. Elimine las claves que ya no estén en `en`.

## Abrir un pull request

1. Cree una rama desde `main` y haga commit de `_locales/<code>/messages.json`.
2. Ejecute las comprobaciones de arriba.
3. Abra un pull request hacia `main` (`gh pr create --base main`, o en GitHub).
   En la descripción indique qué idioma es y si es nuevo o una corrección.
   Preguntas y problemas: abra un issue con el formulario **Translation**.
