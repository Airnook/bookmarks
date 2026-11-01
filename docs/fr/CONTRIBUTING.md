# Contribuer

[🇬🇧 English](../../.github/CONTRIBUTING.md) | [🇷🇺 Русский](../ru/CONTRIBUTING.md) | [🇪🇸 Español](../es/CONTRIBUTING.md) | [🇧🇷 Português (Brasil)](../pt-BR/CONTRIBUTING.md) | **🇫🇷 Français** | [🇩🇪 Deutsch](../de/CONTRIBUTING.md) | [🇨🇳 中文（简体）](../zh-CN/CONTRIBUTING.md) | [🇯🇵 日本語](../ja/CONTRIBUTING.md) | [🇮🇳 हिन्दी](../hi/CONTRIBUTING.md) | [🇸🇦 العربية](../ar/CONTRIBUTING.md)

L'extension est du JavaScript pur (Manifest V3) sans étape de build : le navigateur charge tels quels les fichiers de
la racine du dépôt. Les pages (`panel.html`, `options.html`, `help.html`) chargent des modules ES
(`<script type="module">`) avec des imports explicites ; ce qu'elles partagent se trouve dans `commands.js`. Le script
d'arrière-plan `background.js` est un service worker ordinaire, pas un module. Le code du panneau est découpé en modules
dans `panel/` ; le démarrage et l'ordre des abonnements aux événements sont dans `panel/main.js`, l'état mutable partagé
dans `panel/state.js`. Le texte de l'interface se trouve dans `_locales/<langue>/messages.json` (`chrome.i18n` standard)
et est affiché par `i18n.js` (`t`, pluriels, direction de la page). Les outils de développement (`package.json`,
`eslint.config.js`, `test/`, `scripts/`) ne font pas partie de la version publiée.

### Modules du panneau

Les modules de `panel/` ne s'importent les uns les autres que de haut en bas, sans cycles — `test/panel-imports.test.js`
le vérifie (et affiche le chemin du cycle s'il y en a un). Les couches, de bas en haut :

1. sans dépendance du panneau : `util`, `dom`, `url`, `search`, `place` (où atterrit un élément déplacé), puis `state`,
   `nodes`, `history` (historique des modifications pour annuler et rétablir : tout changement de favoris fait depuis le
   panneau passe par son `begin()`) ;
2. `ui` (boîte de confirmation, messages, focus), `keymap` (aides de touches), `tree` (lecture de l'arbre, cache des
   nœuds) ;
3. `search-index` (index de recherche), `tabs`, `marks` ;
4. `render`, puis `find` (entrer dans la recherche et en sortir), `open`, `edit`, `palette` (choix dans une liste) ;
5. `move-to`, `link`, `search-input` ;
6. `actions` (ce que fait chaque commande) ;
7. `keys`, `mouse`, `drag` (glisser-déposer à la souris), puis `main`.

Un module n'importe que depuis les couches inférieures. Quand un module inférieur doit appeler un module supérieur, il ne
l'importe pas mais reçoit l'appel de l'extérieur : `tree` appelle `onTreeApplied(callback)` après chaque lecture de
l'arbre (`main.js` définit le redessin), `openPalette(run)` exécute la commande choisie via le `run` qu'on lui donne.
L'état nécessaire à plusieurs couches vit dans `state` (par exemple `state.pending` — une séquence de touches en cours :
`keys` la pilote, et `palette` l'annule aussi). Il n'y a pas de bus d'événements : un callback est défini explicitement,
à un seul endroit, au démarrage. `main.js` définit l'ordre des abonnements aux événements, et il compte quand plusieurs
gestionnaires écoutent le même événement.

## Développement

Node.js 20.19+, 22.13+ ou 24+ est requis (une exigence d'ESLint 10).

```sh
npm ci            # install dependencies
npm run lint      # ESLint
npm test          # tests (node --test)
npm run package   # build dist/airnook-bookmarks-<version>.zip and check the archive
npm run test:browser  # smoke test in Chromium (needs npx playwright install chromium)
```

Pour lancer l'extension : `chrome://extensions` → « Mode développeur » → « Charger l'extension non empaquetée » → la racine du dépôt.

### Linter

Les pages sont des modules ES : tout ce qu'un fichier prend dans un autre (`COMMANDS`, `chordOf` de `commands.js`, etc.)
il l'importe explicitement, sinon le linter signale un nom inconnu. Le linter n'autorise pas un `catch {}` vide :
écrivez dedans pourquoi l'erreur peut être ignorée.

### Tests

Les tests importent directement les modules sans DOM (`commands.js`, fonctions pures du panneau dans `panel/`).
`background.js` n'est pas un module, donc les tests le chargent via `node:vm` avec un stub de `chrome` (voir
`test/load.js`) ; la page d'options est aussi chargée via `node:vm` avec des stubs du DOM (voir `test/options-page.js`).

`npm run test:browser` construit l'archive, charge l'extension dans le Chromium de Playwright et vérifie les pages et les
principales touches du panneau : une exécution pour chaque langue de `_locales/`, plus l'hébreu sans traduction et un
faux hébreu de droite à gauche. Seulement certaines langues : `SMOKE_LOCALES=ru,en npm run test:browser` (les noms sont
des dossiers de `_locales`, `he`, `he-rtl`). Il ne fait pas partie de `npm test` ni de la CI : il peut ne pas y avoir de
navigateur.

### Empaquetage

Le contenu de l'archive est une fermeture de références : `manifest.json` → tout ce qu'il référence (service worker,
pages, icônes) → pour chaque page html ses `<script src>`, `<link href>` et `<img src>`, pour chaque script ses `import`
statiques et `export … from` → récursivement. Plus le dossier `_locales/`, s'il existe, et les pages de `EXTRA_PAGES`
dans `scripts/package.mjs` : le code les ouvre par leur nom (par exemple `help.html`), donc les références ne peuvent pas
les trouver. Rien d'autre, y compris les nouveaux fichiers auxiliaires à la racine, n'entre dans l'archive.

Si un `.js` de l'extension obtient une référence vers une nouvelle page html absente de l'archive, le build échoue avec
l'indication de l'ajouter à `EXTRA_PAGES`. Après le build, une vérification distincte s'assure que l'archive ne contient
ni `package.json`, ni configurations du linter, ni `test/`, `scripts/`, `.github/`, `README*.md`, `docs/` (images du
README), `LICENSE`, `TODO.md`, `CONTRIBUTING*.md`, ni fichiers cachés, et que toutes les références sont en place ; en
cas d'erreur, la commande se termine avec un code non nul.

La CI (`.github/workflows/ci.yml`) fait la même chose à chaque push et pull request vers `dev` et `main`.

## Traductions

La traduction de l'interface se trouve dans `_locales/<langue>/messages.json`. Comment ajouter une langue ou corriger une
traduction, et ce que vérifie `npm test`, est décrit dans [TRANSLATING.md](TRANSLATING.md). Un nouveau dossier dans
`_locales/` est pris en compte automatiquement ; aucun changement de code n'est nécessaire.

## Publier une version

1. Augmentez `version` dans `manifest.json` et fusionnez la modification dans `main`.
2. Sur `main`, créez le tag `vX.Y.Z`, où `X.Y.Z` est exactement la version de `manifest.json` :

   ```sh
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. Le workflow `release.yml` vérifie que le tag correspond à la version, exécute le lint et les tests, construit
   l'archive et publie une GitHub Release avec `airnook-bookmarks-X.Y.Z.zip`.

Si le tag et la version ne correspondent pas, le workflow échoue avant le build : supprimez le tag
(`git push --delete origin vX.Y.Z`), corrigez la version et réessayez.
