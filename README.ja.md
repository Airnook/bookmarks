# Airnook Bookmarks

[🇬🇧 English](README.md) | [🇷🇺 Русский](README.ru.md) | [🇪🇸 Español](README.es.md) | [🇧🇷 Português (Brasil)](README.pt-BR.md) | [🇫🇷 Français](README.fr.md) | [🇩🇪 Deutsch](README.de.md) | [🇨🇳 中文（简体）](README.zh-CN.md) | **🇯🇵 日本語** | [🇮🇳 हिन्दी](README.hi.md) | [🇸🇦 العربية](README.ar.md)

[![CI](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml/badge.svg)](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/Airnook/bookmarks)](https://github.com/Airnook/bookmarks/releases/latest)
[![Chromium 141+](https://img.shields.io/badge/Chromium-141%2B-4285F4?logo=googlechrome&logoColor=white)](https://www.chromium.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![10 languages](https://img.shields.io/badge/languages-10-orange)](TRANSLATING.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**ブックマーク** は Chromium 系ブラウザー（Chrome、Edge、Brave、Arc、Helium など）向けの拡張機能です。ページの横のサイドパネルにブックマークを置いて、すべてキーボードで操作できます。探す、開く、フォルダに整理する、ブックマークを固定タブとして保つ。Arc から Chromium 系ブラウザーへ移ったとき、Arc のサイドパネルが恋しくて作りました。

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/panel-dark.png">
    <img src="docs/panel-light.png" alt="ブックマークのサイドパネル: フォルダのツリーと、マークした 2 つのブックマーク" width="360">
  </picture>
</p>

## 目次

- [機能](#機能)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [デフォルトのキー](#デフォルトのキー)
- [プライバシー](#プライバシー)
- [翻訳](#翻訳)
- [開発](#開発)
- [ライセンス](#ライセンス)

## 機能

- ⌨️ **パネル用のショートカットは 1 つ**: `Alt+B`（Mac では `⌥B`）でパネルを開き、ページからフォーカスを戻し、パネルを閉じます。`chrome://extensions/shortcuts` で変更できます。
- 📌 **ブックマークを固定タブにする**（Arc と同じ）: タブが開いているブックマークには点が付きます（中で何かが開いている折りたたまれたフォルダにはリング）。もう一度開くとそのタブに切り替わり、`Shift+Enter` でタブをブックマークの URL に戻し、`U` で現在の URL をブックマークに保存します。このモードは設定でオフにできます。
- 🔎 **検索**: `/` または `⌘F`/`Ctrl+F`。タイトル、URL、フォルダで検索し、一致部分を強調表示します。`Tab` で一致した項目をツリー内の位置で表示します。
- 🗂️ **ブックマークを整理する**: マーク（`スペース`、`Shift+↑↓`、`⌘A`）、名前でフォルダへ移動（`M`、最近使ったフォルダが上に表示され、なければ作成）、リスト内で移動（`Alt+↑↓`）、新しいフォルダ（`N`）、名前を変更（`R`）、削除（`D`）、URL をコピー（`C`）。
- ↩️ **元に戻す・やり直す**（2.6 の新機能）: Mac は `⌘Z` / `⌘⇧Z`、それ以外は `Ctrl+Z` と `Ctrl+Shift+Z` または `Ctrl+Y`、またはメッセージ内の「元に戻す」ボタン。削除したフォルダは中身ごと復元されます。履歴は 50 ステップで、ブラウザーを閉じるまですべてのウィンドウで共通です。
- 🖱️ **ドラッグ＆ドロップ**（2.6 の新機能）: ブックマーク、フォルダ、マークした項目をマウスで上、下、またはフォルダの中へドラッグできます。項目をフォルダの上で止めるとフォルダが開き、端に近づくとリストがスクロールします。
- 📋 **右クリックメニュー**（2.6 の新機能）: ブラウザーのブックマーク メニューと同じ使い方です。新しいタブ、新しいウィンドウ、分割ビュー、シークレット ウィンドウで開く、編集、切り取り・コピー・貼り付け、削除、ページやフォルダの追加、ブックマーク マネージャーを開く。キーボードでは `Shift+F10` で開きます。
- 📂 **セットとして開く**: マークしたブックマークやフォルダ全体を、名前付きのタブグループとして、または通常のタブとして開きます。すでに開いているタブは重複して開きません。
- 🎛️ **コマンドパレット**: `⌘K`/`Ctrl+K` または `?` — すべてのコマンドとそのキー。
- 🔧 **カスタムキー**: どのコマンドも設定でキーを割り当て直せます。Vim プリセット、連続入力（`G G`）、2 回押しもあります。キーは位置で判定されるので、どのキーボード配列でも使えます。
- 👁️ **表示**: `V` で標準、URL 付き（タイトルの下にサイト名）、コンパクトを切り替えます。
- ⚙️ **設定**: 開始フォルダ、ブックマークを新しいタブで開く、ブックマークを固定タブにする、フォーカスがページに移ったらパネルを閉じる。
- 🌍 **10 言語**に対応し、右から左への表記もサポート。組み込みのヘルプ（`i`）ですべての使い方を説明しています。

## インストール

**GitHub Release から**

1. [最新のリリース](https://github.com/Airnook/bookmarks/releases/latest)から `airnook-bookmarks-<バージョン>.zip` をダウンロードします。
2. アーカイブを常設のフォルダに展開します。ブラウザーは拡張機能をそこから読み込みます。
3. `chrome://extensions` を開き、「デベロッパー モード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、`manifest.json` のあるフォルダを選びます。
5. 更新するときは、同じフォルダのファイルを置き換え、拡張機能のカードで「再読み込み」を押します。

**Chrome ウェブストア**: 近日公開。

Chromium 141 以降が必要です。

## クイックスタート

1. `Alt+B` — パネルを開く。もう一度押すと閉じます。フォーカスがページに移っている場合は、同じショートカットでパネルに戻ります。拡張機能のアイコンでもパネルが開きます — ブラウザーの拡張機能メニューで固定してください。
2. `↑` `↓` — リスト内を移動、`→` `←` — フォルダを展開・折りたたみ、`Enter` — 開く。
3. `/` — 検索: タイトル、サイト、フォルダ名を入力し始めます。
4. `スペース` — 複数のブックマークをマーク、`M` — 名前でフォルダへ移動。
5. `⌘K`/`Ctrl+K` — コマンドパレット: すべてのコマンドとそのキー。
6. ブックマーク、フォルダ、空いている場所を右クリックすると、ブラウザーと同じようなメニューが開きます。`Shift+F10` — キーボードから同じメニュー。
7. `i` — ヘルプ。新しいブックマークはブラウザー標準の方法で追加します — `⌘D`/`Ctrl+D`。

## デフォルトのキー

Windows と Linux では `⌘` は `Ctrl` です。どのキーも設定で変更できます。

| 操作 | キー |
| --- | --- |
| リスト内を移動 / フォルダを展開・折りたたみ | `↑` `↓` / `→` `←`、`Home` `End` |
| 開く / もう一方のタブで開く | `Enter` / `⌘Enter` |
| タブをブックマークの URL に戻す | `Shift+Enter` |
| ブックマークを検索 | `/`、`⌘F` |
| コマンドパレット | `⌘K`、`?` |
| メニューを開く | `Shift+F10` |
| マーク / 連続してマーク / フォルダ内をすべてマーク | `スペース` / `Shift+↑↓` / `⌘A` |
| フォルダへ移動… / 上へ・下へ移動 | `M` / `Alt+↑↓` |
| 新しいフォルダ、名前を変更、削除 | `N`、`R`（`F2`）、`D` |
| URL をコピー / タブの URL を保存 | `C` / `U` |
| 切り取り、コピー、貼り付け | `⌘X`、`⌘C`、`⌘V` |
| 元に戻す / やり直す | `⌘Z` / `⌘⇧Z`、`⌘Y` |
| ブックマークのタブを閉じる | `⌫`、`Delete` |
| 表示を切り替え / ヘルプ / 設定 | `V` / `i`（`F1`）/ `,` |
| キャンセルまたは閉じる: マークを解除、検索を終了、パネルを閉じる | `Esc` |

## プライバシー

この拡張機能はローカルでのみ動作し、ネットワークには何も送信しません。ブックマークも履歴もブラウザーの外に出ることはありません。設定はブラウザー内の拡張機能のローカルストレージに保存されます。権限は、ブックマーク、サイドパネル、サイトのアイコン、タブとタブグループ（固定タブモードとセットで開く機能）、設定の保存のために使います。

## 翻訳

インターフェースとヘルプはブラウザーの言語に従います: English, Русский, Español, Português (Brasil), Français, Deutsch, 中文（简体）, 日本語, हिन्दी, العربية。それ以外の言語では英語で表示されます。

自分の言語を追加したい、または翻訳を直したいときは、[TRANSLATING.md](TRANSLATING.md)（英語）を読むか、[「Translation」issue](https://github.com/Airnook/bookmarks/issues/new?template=translation.yml) を作成してください。

## 開発

ビルド不要の素の JavaScript（Manifest V3）です。ブラウザーはリポジトリのルートにあるファイルをそのまま読み込みます。

```sh
npm ci
npm run lint
npm test
npm run test:browser   # Chromium でのスモークテスト: npx playwright install chromium
npm run package        # dist/airnook-bookmarks-<バージョン>.zip
```

アーキテクチャ、テスト、リリース手順は [CONTRIBUTING.md](CONTRIBUTING.md)に記載されています。

## ライセンス

[MIT](LICENSE) © 2026 Airnook
