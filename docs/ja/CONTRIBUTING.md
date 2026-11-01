# コントリビュート

[🇬🇧 English](../../.github/CONTRIBUTING.md) | [🇷🇺 Русский](../ru/CONTRIBUTING.md) | [🇪🇸 Español](../es/CONTRIBUTING.md) | [🇧🇷 Português (Brasil)](../pt-BR/CONTRIBUTING.md) | [🇫🇷 Français](../fr/CONTRIBUTING.md) | [🇩🇪 Deutsch](../de/CONTRIBUTING.md) | [🇨🇳 中文（简体）](../zh-CN/CONTRIBUTING.md) | **🇯🇵 日本語** | [🇮🇳 हिन्दी](../hi/CONTRIBUTING.md) | [🇸🇦 العربية](../ar/CONTRIBUTING.md)

この拡張機能は、ビルド手順のない素の JavaScript（Manifest V3）です。ブラウザーはリポジトリのルートにあるファイルを
そのまま読み込みます。ページ（`panel.html`、`options.html`、`help.html`）は明示的な import で ES モジュール
（`<script type="module">`）を読み込み、共有するものは `commands.js` にあります。バックグラウンドスクリプト
`background.js` は通常の service worker で、モジュールではありません。パネルのコードは `panel/` のモジュールに分かれて
おり、起動とイベント購読の順序は `panel/main.js`、共有される可変の状態は `panel/state.js` にあります。インターフェースの
テキストは `_locales/<言語>/messages.json`（標準の `chrome.i18n`）にあり、`i18n.js`（`t`、複数形、ページの方向）が表示
します。開発ツール（`package.json`、`eslint.config.js`、`test/`、`scripts/`）はリリースに含まれません。 ルートには、テーマ（`theme.js`、パネルと設定で共有）と設定ファイルの形式（`settings-file.js`：エンベロープと `format` ごとの移行チェーン。キー割り当てとテーマのインポート・エクスポートで使用）もあります。

### パネルのモジュール

`panel/` のモジュールは上から下へのみ互いを import し、循環はありません。これは `test/panel-imports.test.js` が確認します
（循環があればそのパスを出力します）。層は下から順に次のとおりです。

1. パネルへの依存なし: `demo`、`util`、`dom`、`url`、`search`、`place`（移動した項目の行き先）、続いて `state`、`nodes`、
   `history`（元に戻す・やり直しのための編集履歴。パネルからのブックマークのあらゆる変更はその `begin()` を通る）
2. `ui`（確認ダイアログ、メッセージ、フォーカス）、`keymap`（キーのヒント）、`tree`（ツリーの読み取り、ノードのキャッシュ）
3. `search-index`（検索インデックス）、`tabs`、`marks`、`undo-buttons` （ヘッダーの「元に戻す」「やり直し」ボタン）
4. `render`、続いて `find`（検索の開始と終了）、`open`、`edit`、`palette`（リストからの選択）
5. `move-to`、`link`、`search-input`
6. `actions`（各コマンドの動作）
7. `keys`、`mouse`、`drag`（マウスによるドラッグ＆ドロップ）、続いて `main`

`demo` はパネルの他のモジュールに依存しませんが、`main.js` の最初のインポートでなければなりません。デモモード（`panel.html?demo`、設定のテーマプレビュー）では、他のモジュールが `chrome` を読む前に、メモリ上の固定データに差し替えます。

モジュールは自分より下の層からのみ import します。下の層のモジュールが上の層を呼ぶ必要があるときは、それを import せず、
外部から呼び出しを受け取ります。`tree` はツリーを読み取るたびに `onTreeApplied(callback)` を呼び（再描画は `main.js` が
設定）、`openPalette(run)` は渡された `run` を通じて選ばれたコマンドを実行します。複数の層が必要とする状態は `state` に
あります（たとえば `state.pending`。進行中のキー入力列で、`keys` が管理し、`palette` も取り消します）。イベントバスは
ありません。コールバックは起動時に 1 か所で明示的に設定します。`main.js` がイベント購読の順序を決めており、複数の
ハンドラーが同じイベントを待ち受ける場合は、その順序が重要です。

## 開発

Node.js 20.19+、22.13+ または 24+ が必要です（ESLint 10 の要件）。

```sh
npm ci            # install dependencies
npm run lint      # ESLint
npm test          # tests (node --test)
npm run package   # build dist/airnook-bookmarks-<version>.zip and check the archive
npm run test:browser  # smoke test in Chromium (needs npx playwright install chromium)
```

拡張機能を実行するには: `chrome://extensions` →「デベロッパー モード」→「パッケージ化されていない拡張機能を読み込む」→ リポジトリのルート。

### リンター

ページは ES モジュールです。ファイルが別のファイルから使うもの（`commands.js` の `COMMANDS`、`chordOf` など）は明示的に
import してください。そうしないとリンターが未知の名前を報告します。リンターは空の `catch {}` を許可しません。エラーを無視
してよい理由をその中に書いてください。

### テスト

テストは DOM を使わないモジュール（`commands.js`、`panel/` の純粋なパネル関数）を直接 import します。`background.js` は
モジュールではないため、テストは `chrome` のスタブとともに `node:vm` 経由で読み込みます（`test/load.js` を参照）。
オプションページも DOM のスタブとともに `node:vm` 経由で読み込みます（`test/options-page.js` を参照）。

`npm run test:browser` はアーカイブをビルドし、Playwright の Chromium に拡張機能を読み込んで、各ページとパネルの主なキーを
確認します。`_locales/` のすべての言語について 1 回ずつ実行し、さらに翻訳のないヘブライ語と架空の右から左のヘブライ語も
実行します。一部の言語のみ: `SMOKE_LOCALES=ru,en npm run test:browser`（名前は `_locales` のフォルダー、`he`、`he-rtl`）。
これは `npm test` や CI には含まれません。そこにはブラウザーがない場合があるためです。

### パッケージング

アーカイブの内容は参照の閉包です。`manifest.json` → それが参照するすべて（service worker、ページ、アイコン）→ 各 html
ページについてはその `<script src>`、`<link href>`、`<img src>`、各スクリプトについてはその静的な `import` と
`export … from` → 再帰的に。加えて、あれば `_locales/` フォルダーと、`scripts/package.mjs` の `EXTRA_PAGES` にあるページ。
コードはこれらを名前で開く（たとえば `help.html`）ため、参照からは見つかりません。それ以外のもの（ルートに追加した新しい
補助ファイルを含む）はアーカイブに入りません。

拡張機能の `.js` が、アーカイブにない新しい html ページへの参照を持つと、ビルドは `EXTRA_PAGES` に追加するよう促す
ヒントとともに失敗します。ビルド後、別のチェックがアーカイブに `package.json`、リンターの設定、`test/`、`scripts/`、
`.github/`、`README*.md`、`docs/`（README の画像）、`LICENSE`、`TODO.md`、`CONTRIBUTING*.md`、隠しファイルがなく、
すべての参照が揃っていることを確認します。エラーの場合、コマンドはゼロ以外の終了コードで終了します。

CI（`.github/workflows/ci.yml`）は、`dev` と `main` への push と pull request のたびに同じことを行います。

## 翻訳

インターフェースの翻訳は `_locales/<言語>/messages.json` にあります。言語の追加や翻訳の修正の方法、および `npm test` が
確認する内容は [TRANSLATING.md](TRANSLATING.md) にあります。`_locales/` に新しいフォルダーを作ると自動的に認識されます。
コードの変更は不要です。

## リリース

1. `manifest.json` の `version` を上げ、その変更を `main` にマージします。
2. `main` でタグ `vX.Y.Z` を作成します。`X.Y.Z` は `manifest.json` のバージョンと完全に一致させます。

   ```sh
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. `release.yml` ワークフローが、タグがバージョンと一致することを確認し、lint とテストを実行し、アーカイブをビルドして、
   `airnook-bookmarks-X.Y.Z.zip` を含む GitHub Release を公開します。

タグとバージョンが一致しない場合、ワークフローはビルドの前に失敗します。タグを削除し
（`git push --delete origin vX.Y.Z`）、バージョンを修正してやり直してください。
