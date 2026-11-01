# Traduire Bookmarks

[🇬🇧 English](../../.github/TRANSLATING.md) | [🇷🇺 Русский](../ru/TRANSLATING.md) | [🇪🇸 Español](../es/TRANSLATING.md) | [🇧🇷 Português (Brasil)](../pt-BR/TRANSLATING.md) | **🇫🇷 Français** | [🇩🇪 Deutsch](../de/TRANSLATING.md) | [🇨🇳 中文（简体）](../zh-CN/TRANSLATING.md) | [🇯🇵 日本語](../ja/TRANSLATING.md) | [🇮🇳 हिन्दी](../hi/TRANSLATING.md) | [🇸🇦 العربية](../ar/TRANSLATING.md)

Les textes de l'interface se trouvent dans `_locales/<code>/messages.json` (le format standard `chrome.i18n` de Chrome).
Ce guide ne concerne que ce fichier. Chrome choisit le dossier qui correspond à la langue du navigateur ;
s'il n'y en a pas, le texte anglais (`_locales/en`) est utilisé.

## Ajouter une nouvelle langue

1. Choisissez un code dans la [liste des paramètres régionaux de Chrome](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
   Chrome ignore les codes qu'il ne prend pas en charge. Utilisez un tiret bas dans le nom du dossier : `pt_BR`, `zh_CN`, `es_419`.
2. Copiez `_locales/en/messages.json` vers `_locales/<code>/messages.json`.
3. Mettez dans `locale` le même code avec un trait d'union : `pt-BR`, `zh-CN`, `es-419`.
4. Mettez `ltr` ou `rtl` dans `dir`.
5. Traduisez chaque `message`, puis lancez les vérifications ci-dessous.

Aucune modification du code n'est nécessaire : les tests trouvent eux-mêmes tous les dossiers de `_locales/`.

## Clés et champs

- **Ne changez jamais une clé** (le nom avant `"message"`). Le code utilise ces noms.
- **`message`** — le texte que vous traduisez.
- **`description`** — contexte pour les traducteurs, par exemple où le texte apparaît. Il n'est pas affiché dans l'extension.
  Dans `en`, chaque message avec `placeholders` en a besoin, y compris chaque forme plurielle (`_one`, `_other`…) : indiquez où le texte s'affiche et ce qu'est chaque `$NAME$`.
  `npm test` le vérifie. Les autres langues peuvent l'omettre.
- **`locale`** — le code de langue du fichier. Les formes plurielles et le `lang` de la page en découlent.
- **`dir`** — `ltr` (de gauche à droite) ou `rtl` (de droite à gauche, par exemple arabe, hébreu, persan, ourdou).
  Les pages en tirent leur direction.

## Espaces réservés

`$NAME$` dans un `message` est remplacé par la valeur de l'espace réservé portant ce nom.
Gardez le nom et les signes `$`, et placez l'espace réservé là où votre langue en a besoin :

```json
"more_results": {
  "message": "$COUNT$ more — refine the search",
  "placeholders": {
    "count": { "content": "$1" }
  }
}
```

- Utilisez les mêmes noms d'espaces réservés que dans `en`. `content` reste `$1`, `$2`… comme dans `en`.
- Ne traduisez pas le texte à l'intérieur de `$…$`.
- Écrivez `$$` pour un signe dollar littéral.

## Formes plurielles

Un message avec un nombre a une clé par catégorie plurielle CLDR : `<key>_one`, `<key>_few`, `<key>_many`, `<key>_other`.
Utilisez les catégories de votre langue, et toutes : les [règles plurielles CLDR](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
les énumèrent (l'anglais a `one` et `other` ; le russe a `one`, `few`, `many`, `other`).
`npm test` échoue si une catégorie manque et nomme les clés manquantes. `_other` est obligatoire.
Ne gardez pas de clé simple (`bookmarks`) à côté des formes.

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

Le russe (`ru`) pour la même clé utilise `bookmarks_one` (« $COUNT$ закладка »), `_few` (« $COUNT$ закладки »),
`_many` (« $COUNT$ закладок »), `_other` (« $COUNT$ закладки »).

## Mots de la palette de commandes (`cmd_*_words`)

Chaque commande a `cmd_<id>` (son nom), éventuellement `cmd_<id>_note` (une seconde ligne) et `cmd_<id>_words` :
des mots supplémentaires pour chercher dans la palette, dans votre langue, séparés par des espaces.
Les mots de recherche anglais sont toujours utilisés aussi, donc les `cmd_*_words` de `en` restent vides.
Les clés à valeur vide sont permises, mais toutes doivent exister.

```json
"cmd_search_words": {
  "message": "найти фильтр",
  "description": "Extra words to find the command in the palette, in your language; the English words always work"
}
```

## Vérifier en local

Nécessite Node.js 20.19+, 22.13+ ou 24+ (la CI utilise 22).

```sh
npm ci            # install dependencies
npm test          # checks every language in _locales/
npm run lint
npm run package   # builds dist/*.zip; _locales/ is included
```

`npm test` vérifie, pour chaque langue :

- les mêmes clés que `en` (ni manquantes ni en trop ; les formes plurielles comptent pour une clé) ;
- `locale` et `dir` sont définis, et `locale` correspond au nom du dossier ;
- formes plurielles : chaque catégorie de la langue est présente, aucune autre, et `_other` existe ;
- les espaces réservés correspondent à `en`, et chaque `content` est `$1`…`$9` ;
- `en` a une `description` pour chaque message avec espaces réservés ;
- chaque clé utilisée par le code existe dans `en`.

Pour voir l'interface dans votre langue, chargez l'extension non empaquetée dans un navigateur réglé sur cette langue :

1. Réglez la langue de l'interface du navigateur sur la vôtre (Chrome : Paramètres → Langues ; redémarrez le navigateur).
2. Ouvrez `chrome://extensions`, activez le « Mode développeur » (« Developer mode »), cliquez sur « Charger l'extension non empaquetée » (« Load unpacked ») et choisissez la racine du dépôt.
3. Ouvrez le panneau latéral et vérifiez les textes, les formes plurielles et, pour `rtl`, la mise en page.

`npm run test:browser` (nécessite `npx playwright install chromium`) ouvre les pages d'aide, d'options et du panneau latéral dans un vrai navigateur,
une fois pour chaque dossier de langue de `_locales/`, une fois pour l'hébreu (pas de traduction, donc texte anglais) et une fois pour un faux hébreu de droite à gauche.
Ne vérifiez que votre langue pendant que vous travaillez : `SMOKE_LOCALES=pt_BR npm run test:browser` (noms séparés par des virgules : noms de dossiers, `he`, `he-rtl`).

## Mettre à jour une traduction existante

Quand `en` reçoit de nouvelles clés ou change, `npm test` échoue et liste les clés manquantes dans chaque langue.
Ajoutez-les, traduisez-les et relancez `npm test`. Supprimez les clés qui ne sont plus dans `en`.

## Ouvrir une pull request

1. Créez une branche à partir de `main` et commitez `_locales/<code>/messages.json`.
2. Lancez les vérifications ci-dessus.
3. Ouvrez une pull request vers `main` (`gh pr create --base main`, ou sur GitHub).
   Dans la description, indiquez quelle langue et s'il s'agit d'une nouvelle langue ou d'une correction.
   Questions et problèmes : ouvrez une issue avec le formulaire **Translation**.
