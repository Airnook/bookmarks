# Airnook Bookmarks

[🇬🇧 English](README.md) | [🇷🇺 Русский](README.ru.md) | [🇪🇸 Español](README.es.md) | [🇧🇷 Português (Brasil)](README.pt-BR.md) | **🇫🇷 Français** | [🇩🇪 Deutsch](README.de.md) | [🇨🇳 中文（简体）](README.zh-CN.md) | [🇯🇵 日本語](README.ja.md) | [🇮🇳 हिन्दी](README.hi.md) | [🇸🇦 العربية](README.ar.md)

[![CI](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml/badge.svg)](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/Airnook/bookmarks)](https://github.com/Airnook/bookmarks/releases/latest)
[![Chromium 141+](https://img.shields.io/badge/Chromium-141%2B-4285F4?logo=googlechrome&logoColor=white)](https://www.chromium.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![10 languages](https://img.shields.io/badge/languages-10-orange)](TRANSLATING.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Favoris** est une extension pour les navigateurs Chromium (Chrome, Edge, Brave, Arc, Helium et d’autres) : vos favoris
dans le panneau latéral, à côté de la page, tout au clavier. Rechercher, ouvrir, classer dans des dossiers, garder les
favoris en onglets épinglés. Créée lors du passage d’Arc à un navigateur Chromium : son panneau latéral manquait.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/panel-dark.png">
    <img src="docs/panel-light.png" alt="Le panneau latéral Favoris : une arborescence de dossiers avec deux favoris sélectionnés" width="360">
  </picture>
</p>

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Démarrage rapide](#démarrage-rapide)
- [Touches par défaut](#touches-par-défaut)
- [Confidentialité](#confidentialité)
- [Traductions](#traductions)
- [Développement](#développement)
- [Licence](#licence)

## Fonctionnalités

- ⌨️ **Un raccourci pour le panneau** : `Alt+B` (`⌥B` sur Mac) ouvre le panneau, y ramène le focus depuis la page et le
  ferme. Il se modifie dans `chrome://extensions/shortcuts`.
- 📌 **Favoris en onglets épinglés**, comme dans Arc : un point sur les favoris dont l’onglet est ouvert (et un anneau
  sur un dossier réduit qui contient quelque chose d’ouvert). Rouvrir un favori bascule vers son onglet, `Shift+Enter`
  remet l’onglet à l’adresse du favori, `U` enregistre l’adresse actuelle dans le favori. Le mode peut être désactivé
  dans les paramètres.
- 🔎 **Recherche** : `/` ou `⌘F`/`Ctrl+F`, par titre, adresse et dossier, avec surlignage. `Tab` montre le résultat à sa
  place dans l’arborescence.
- 🗂️ **Trier les favoris** : sélection (`Espace`, `Shift+↑↓`, `⌘A`), déplacement vers un dossier par son nom (`M`,
  dossiers récents en premier ; s’il n’existe pas, il est créé), déplacement dans la liste (`Alt+↑↓`), nouveau dossier
  (`N`), renommer (`R`), supprimer (`D`), copier les adresses (`C`).
- ↩️ **Annuler et rétablir** (nouveau dans la 2.6) : `⌘Z` / `⌘⇧Z` sur Mac, `Ctrl+Z` et `Ctrl+Shift+Z` ou `Ctrl+Y`
  ailleurs, ou le bouton « Annuler » du message. Un dossier supprimé revient avec son contenu. L’historique garde
  50 étapes et il est commun à toutes les fenêtres jusqu’à la fermeture du navigateur.
- 🖱️ **Glisser-déposer** (nouveau dans la 2.6) : faites glisser à la souris des favoris, des dossiers et la sélection
  au-dessus, en dessous ou dans un dossier. Le dossier s’ouvre quand on y maintient un élément, et la liste défile près
  du bord.
- 📋 **Menu du clic droit** (nouveau dans la 2.6), comme le menu des favoris du navigateur : ouvrir dans un nouvel
  onglet, une nouvelle fenêtre, en vue fractionnée ou dans une fenêtre de navigation privée ; modifier ; couper, copier
  et coller ; supprimer ; ajouter une page ou un dossier ; ouvrir le gestionnaire de favoris. Au clavier : `Shift+F10`.
- 📂 **Ouvrir en ensemble** : les favoris sélectionnés ou un dossier entier, en groupe d’onglets nommé ou en onglets
  ordinaires. Les onglets déjà ouverts ne sont pas dupliqués.
- 🎛️ **Palette de commandes** : `⌘K`/`Ctrl+K` ou `?` — toutes les commandes avec leurs touches.
- 🔧 **Vos propres touches** : chaque commande peut être réassignée dans les paramètres. Il existe un jeu Vim, des
  séquences (`G G`) et des doubles appuis. Les touches sont reconnues par leur position : elles fonctionnent avec
  n’importe quelle disposition de clavier.
- 👁️ **Affichage** : `V` alterne entre normal, avec l’adresse sous le titre, et compact.
- ⚙️ **Paramètres** : dossier de départ, ouvrir les favoris dans un nouvel onglet, favoris en onglets épinglés, fermer
  le panneau quand le focus passe à la page.
- 🌍 **10 langues** avec prise en charge de l’écriture de droite à gauche ; l’aide intégrée (`i`) décrit tous les
  usages.

## Installation

**Depuis GitHub Release**

1. Téléchargez `airnook-bookmarks-<version>.zip` depuis la [dernière version](https://github.com/Airnook/bookmarks/releases/latest).
2. Décompressez l’archive dans un dossier permanent : le navigateur lit l’extension depuis cet emplacement.
3. Ouvrez `chrome://extensions` et activez le « Mode développeur ».
4. Cliquez sur « Charger l’extension non empaquetée » et choisissez le dossier qui contient `manifest.json`.
5. Pour mettre à jour, remplacez les fichiers dans le même dossier et cliquez sur « Actualiser » sur la carte de
   l’extension.

**Chrome Web Store** : bientôt disponible.

Chromium 141 ou une version plus récente est nécessaire.

## Démarrage rapide

1. `Alt+B` — ouvrir le panneau. Appuyez de nouveau pour le fermer ; si le focus est passé à la page, le même raccourci
   le ramène dans le panneau. L’icône de l’extension ouvre aussi le panneau — épinglez-la dans le menu des extensions du
   navigateur.
2. `↑` `↓` — se déplacer dans la liste, `→` `←` — développer et réduire un dossier, `Enter` — ouvrir.
3. `/` — recherche : commencez à taper un titre, un site ou un dossier.
4. `Espace` — sélectionner plusieurs favoris, `M` — les déplacer vers un dossier par son nom.
5. `⌘K`/`Ctrl+K` — palette de commandes : toutes les commandes avec leurs touches.
6. Clic droit sur un favori, un dossier ou un espace vide : un menu comme celui du navigateur ; `Shift+F10` — la même
   chose au clavier.
7. `i` — aide. Les nouveaux favoris s’ajoutent comme d’habitude dans le navigateur — `⌘D`/`Ctrl+D`.

## Touches par défaut

`⌘` correspond à `Ctrl` sous Windows et Linux. Chaque touche peut être modifiée dans les paramètres.

| Action | Touches |
| --- | --- |
| Se déplacer dans la liste / développer, réduire un dossier | `↑` `↓` / `→` `←`, `Home` `End` |
| Ouvrir / ouvrir dans un autre onglet | `Enter` / `⌘Enter` |
| Remettre l’onglet à l’adresse du favori | `Shift+Enter` |
| Rechercher des favoris | `/`, `⌘F` |
| Palette de commandes | `⌘K`, `?` |
| Ouvrir le menu | `Shift+F10` |
| Sélectionner / à la suite / tout sélectionner dans le dossier | `Espace` / `Shift+↑↓` / `⌘A` |
| Déplacer vers le dossier… / déplacer vers le haut, le bas | `M` / `Alt+↑↓` |
| Nouveau dossier, renommer, supprimer | `N`, `R` (`F2`), `D` |
| Copier l’adresse / enregistrer l’adresse de l’onglet | `C` / `U` |
| Couper, copier, coller | `⌘X`, `⌘C`, `⌘V` |
| Annuler la modification / rétablir | `⌘Z` / `⌘⇧Z`, `⌘Y` |
| Fermer l’onglet du favori | `⌫`, `Delete` |
| Changer l’affichage / aide / paramètres | `V` / `i` (`F1`) / `,` |
| Annuler ou fermer : effacer la sélection, quitter la recherche, fermer le panneau | `Esc` |

## Confidentialité

L’extension fonctionne uniquement en local et n’envoie rien sur le réseau : ni vos favoris ni votre historique ne
quittent le navigateur. Les paramètres sont conservés dans le stockage local de l’extension, dans le navigateur. Les
autorisations servent aux favoris, au panneau latéral, aux icônes des sites, aux onglets et groupes d’onglets (mode
onglets épinglés et ouverture d’ensembles) et à l’enregistrement des paramètres.

## Traductions

L’interface et l’aide suivent la langue du navigateur : English, Русский, Español, Português (Brasil), Français,
Deutsch, 中文（简体）, 日本語, हिन्दी, العربية. Pour les autres langues, l’anglais est utilisé.

Vous voulez ajouter votre langue ou corriger une traduction ? Consultez [TRANSLATING.md](TRANSLATING.md) (en anglais) ou
ouvrez une [issue « Translation »](https://github.com/Airnook/bookmarks/issues/new?template=translation.yml).

## Développement

Du JavaScript pur (Manifest V3) sans étape de build : le navigateur charge les fichiers de la racine du dépôt tels quels.

```sh
npm ci
npm run lint
npm test
npm run test:browser   # test de fumée dans Chromium : npx playwright install chromium
npm run package        # dist/airnook-bookmarks-<version>.zip
```

L’architecture, les tests et la publication des versions sont décrits dans [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[MIT](LICENSE) © 2026 Airnook
