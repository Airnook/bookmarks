# Bookmarks を翻訳する

[🇬🇧 English](../../.github/TRANSLATING.md) | [🇷🇺 Русский](../ru/TRANSLATING.md) | [🇪🇸 Español](../es/TRANSLATING.md) | [🇧🇷 Português (Brasil)](../pt-BR/TRANSLATING.md) | [🇫🇷 Français](../fr/TRANSLATING.md) | [🇩🇪 Deutsch](../de/TRANSLATING.md) | [🇨🇳 中文（简体）](../zh-CN/TRANSLATING.md) | **🇯🇵 日本語** | [🇮🇳 हिन्दी](../hi/TRANSLATING.md) | [🇸🇦 العربية](../ar/TRANSLATING.md)

インターフェースのテキストは `_locales/<code>/messages.json`（Chrome 標準の `chrome.i18n` 形式）にあります。
このガイドが扱うのはこのファイルだけです。Chrome はブラウザーの言語に合うフォルダーを選びます。
該当するものがなければ、英語のテキスト（`_locales/en`）が使われます。

## 新しい言語を追加する

1. [Chrome のロケール一覧](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales)からコードを選びます。
   Chrome は対応していないコードを無視します。フォルダー名にはアンダースコアを使います: `pt_BR`、`zh_CN`、`es_419`。
2. `_locales/en/messages.json` を `_locales/<code>/messages.json` にコピーします。
3. `locale` に同じコードをハイフン区切りで設定します: `pt-BR`、`zh-CN`、`es-419`。
4. `dir` を `ltr` または `rtl` に設定します。
5. すべての `message` を翻訳し、下記のチェックを実行します。

コードの変更は不要です。テストが `_locales/` のすべてのフォルダーを自動的に見つけます。

## キーとフィールド

- **キーは絶対に変更しないでください**（`"message"` の前の名前）。コードがこの名前を使います。
- **`message`** — 翻訳するテキスト。
- **`description`** — 翻訳者向けの文脈（たとえばテキストが表示される場所）。拡張機能には表示されません。
  `en` では、`placeholders` を持つすべてのメッセージ（複数形のすべての形 `_one`、`_other`… を含む）に必要です。テキストが表示される場所と各 `$NAME$` が何かを書いてください。
  `npm test` がこれを確認します。他の言語では省略できます。
- **`locale`** — ファイルの言語コード。複数形とページの `lang` はここから決まります。
- **`dir`** — `ltr`（左から右）または `rtl`（右から左。たとえばアラビア語、ヘブライ語、ペルシア語、ウルドゥー語）。
  ページはここから文字の方向を決めます。

## プレースホルダー

`message` 内の `$NAME$` は、同じ名前のプレースホルダーの値に置き換えられます。
名前と `$` 記号はそのままにして、プレースホルダーをその言語で必要な位置に移動してください。

```json
"more_results": {
  "message": "$COUNT$ more — refine the search",
  "placeholders": {
    "count": { "content": "$1" }
  }
}
```

- `en` と同じプレースホルダー名を使います。`content` は `en` と同じく `$1`、`$2`… のままです。
- `$…$` の中のテキストは翻訳しません。
- 文字どおりのドル記号には `$$` と書きます。

## 複数形

数を含むメッセージには、CLDR の複数形カテゴリーごとにキーがあります: `<key>_one`、`<key>_few`、`<key>_many`、`<key>_other`。
その言語にあるカテゴリーをすべて使ってください。[CLDR の複数形ルール](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)に
一覧があります（英語は `one` と `other`、ロシア語は `one`、`few`、`many`、`other`）。
カテゴリーが欠けていると `npm test` は失敗し、足りないキーを示します。`_other` は必須です。
これらの形と並べて、接尾辞のないキー（`bookmarks`）を残さないでください。

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

同じキーに対してロシア語（`ru`）は `bookmarks_one`（「$COUNT$ закладка」）、`_few`（「$COUNT$ закладки」）、
`_many`（「$COUNT$ закладок」）、`_other`（「$COUNT$ закладки」）を使います。

## コマンドパレットの単語（`cmd_*_words`）

各コマンドには `cmd_<id>`（名前）、必要に応じて `cmd_<id>_note`（2 行目）、そして `cmd_<id>_words` があります。
`cmd_<id>_words` は、パレットで検索するためのその言語の追加の単語で、スペース区切りです。
英語の検索語も常に使われるため、`en` の `cmd_*_words` は空のままです。
値が空のキーは許されますが、すべてのキーが存在している必要があります。

```json
"cmd_search_words": {
  "message": "найти фильтр",
  "description": "Extra words to find the command in the palette, in your language; the English words always work"
}
```

## ローカルで確認する

Node.js 20.19+、22.13+ または 24+ が必要です（CI は 22 を使用）。

```sh
npm ci            # install dependencies
npm test          # checks every language in _locales/
npm run lint
npm run package   # builds dist/*.zip; _locales/ is included
```

`npm test` は各言語について次を確認します。

- `en` と同じキー（不足も余分もない。複数形は 1 つのキーとして数える）
- `locale` と `dir` が設定されており、`locale` がフォルダー名と一致する
- 複数形: その言語のすべてのカテゴリーがあり、余計なものはなく、`_other` がある
- プレースホルダーが `en` と一致し、各 `content` が `$1`…`$9` である
- `en` でプレースホルダーを持つすべてのメッセージに `description` がある
- コードが使うすべてのキーが `en` に存在する

自分の言語でインターフェースを確認するには、その言語のブラウザーでパッケージ化されていない拡張機能を読み込みます。

1. ブラウザーの表示言語を自分の言語に設定します（Chrome: 設定 → 言語。ブラウザーを再起動）。
2. `chrome://extensions` を開き、「デベロッパー モード」（「Developer mode」）をオンにして、「パッケージ化されていない拡張機能を読み込む」（「Load unpacked」）をクリックし、リポジトリのルートを選びます。
3. サイドパネルを開き、テキスト、複数形、`rtl` の場合はレイアウトを確認します。

`npm run test:browser`（`npx playwright install chromium` が必要）は、ヘルプ、オプション、サイドパネルのページを実際のブラウザーで開きます。
`_locales/` の各言語フォルダーで 1 回ずつ、ヘブライ語（翻訳がないので英語のテキスト）で 1 回、架空の右から左のヘブライ語で 1 回実行されます。
作業中は自分の言語だけ確認してください: `SMOKE_LOCALES=pt_BR npm run test:browser`（名前はカンマ区切り: フォルダー名、`he`、`he-rtl`）。

## 既存の翻訳を更新する

`en` に新しいキーが追加されたり変更されたりすると、`npm test` が失敗し、各言語で不足しているキーを列挙します。
それらを追加して翻訳し、もう一度 `npm test` を実行してください。`en` からなくなったキーは削除します。

## プルリクエストを開く

1. `dev` からブランチを作成し、`_locales/<code>/messages.json` をコミットします。
2. 上記のチェックを実行します。
3. `dev` へのプルリクエストを開きます（`gh pr create --base dev`、または GitHub 上で）。
   説明には、どの言語か、新規か修正かを書いてください。
   質問や問題: **Translation** フォームで issue を開いてください。
