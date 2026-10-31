# Airnook Bookmarks

[🇬🇧 English](README.md) | [🇷🇺 Русский](README.ru.md) | [🇪🇸 Español](README.es.md) | [🇧🇷 Português (Brasil)](README.pt-BR.md) | [🇫🇷 Français](README.fr.md) | [🇩🇪 Deutsch](README.de.md) | **🇨🇳 中文（简体）** | [🇯🇵 日本語](README.ja.md) | [🇮🇳 हिन्दी](README.hi.md) | [🇸🇦 العربية](README.ar.md)

[![CI](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml/badge.svg)](https://github.com/Airnook/bookmarks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/Airnook/bookmarks)](https://github.com/Airnook/bookmarks/releases/latest)
[![Chromium 141+](https://img.shields.io/badge/Chromium-141%2B-4285F4?logo=googlechrome&logoColor=white)](https://www.chromium.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![10 languages](https://img.shields.io/badge/languages-10-orange)](TRANSLATING.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**书签** 是一款适用于 Chromium 浏览器（Chrome、Edge、Brave、Arc、Helium 等）的扩展程序：书签就在侧边栏中、网页旁边，全程键盘操作。查找、打开、分类到文件夹、将书签保持为固定标签页。为从 Arc 迁移到 Chromium 浏览器而做：原来很怀念 Arc 的侧边栏。

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/panel-dark.png">
    <img src="docs/panel-light.png" alt="书签侧边栏：文件夹树，其中两个书签已标记" width="360">
  </picture>
</p>

## 目录

- [功能](#功能)
- [安装](#安装)
- [快速入门](#快速入门)
- [默认按键](#默认按键)
- [隐私](#隐私)
- [翻译](#翻译)
- [开发](#开发)
- [许可证](#许可证)

## 功能

- ⌨️ **一个快捷键控制面板**：`Alt+B`（Mac 上为 `⌥B`）打开面板、把焦点从网页带回面板、关闭面板。可在 `chrome://extensions/shortcuts` 中更改。
- 📌 **将书签作为固定标签页**，类似 Arc：已打开标签页的书签旁有一个圆点（折叠的文件夹中有已打开的内容时显示一个圆环）。再次打开书签会切换到它的标签页，`Shift+Enter` 让标签页回到书签网址，`U` 将当前网址保存到书签中。此模式可在设置中关闭。
- 🔎 **搜索**：`/` 或 `⌘F`/`Ctrl+F`，按标题、网址和文件夹搜索，并高亮显示。`Tab` 在树中原位显示匹配项。
- 🗂️ **整理书签**：标记（`空格`、`Shift+↑↓`、`⌘A`），按名称移动到文件夹（`M`，最近使用的文件夹排在前面；没有该文件夹时会新建），在列表中移动（`Alt+↑↓`），新建文件夹（`N`），重命名（`R`），删除（`D`），复制网址（`C`）。
- ↩️ **撤消和重做**（2.6 新增）：Mac 上按 `⌘Z` / `⌘⇧Z`，其他系统按 `Ctrl+Z` 与 `Ctrl+Shift+Z` 或 `Ctrl+Y`，也可点击消息中的“撤消”按钮。删除的文件夹会连同内容一起恢复。历史记录保留 50 步，在关闭浏览器前所有窗口共用。
- 🖱️ **拖放**（2.6 新增）：用鼠标把书签、文件夹和已标记项拖到目标上方、下方或文件夹内。把项目悬停在文件夹上会将其展开，靠近边缘时列表会滚动。
- 📋 **右键菜单**（2.6 新增），与浏览器的书签菜单一致：在新标签页、新窗口、拆分视图或无痕式窗口中打开；修改；剪切、复制和粘贴；删除；添加网页或文件夹；打开书签管理器。用键盘按 `Shift+F10` 打开。
- 📂 **成组打开**：已标记的书签或整个文件夹，可作为带名称的标签页组或普通标签页打开。已打开的标签页不会重复打开。
- 🎛️ **命令面板**：`⌘K`/`Ctrl+K` 或 `?` — 所有命令及其按键。
- 🔧 **自定义按键**：任何命令都可在设置中重新分配按键。提供 Vim 预设、按键序列（`G G`）和双击按键。按键按位置识别，因此在任何键盘布局下都能使用。
- 👁️ **视图**：`V` 在常规、显示网址（标题下方显示网站）和紧凑之间切换。
- ⚙️ **设置**：起始文件夹、在新标签页中打开书签、将书签作为固定标签页、焦点移到网页时关闭面板。
- 🌍 **10 种语言**，支持从右到左书写；内置帮助（`i`）介绍了所有用法。

## 安装

**从 GitHub Release 安装**

1. 从[最新版本](https://github.com/Airnook/bookmarks/releases/latest)下载 `airnook-bookmarks-<版本>.zip`。
2. 将压缩包解压到一个固定的文件夹：浏览器会从那里读取扩展程序。
3. 打开 `chrome://extensions`，开启“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的文件夹。
5. 更新时，替换同一文件夹中的文件，然后在扩展程序卡片上点击“重新加载”。

**Chrome 应用商店**：即将上架。

需要 Chromium 141 或更高版本。

## 快速入门

1. `Alt+B` — 打开面板。再按一次关闭；如果焦点移到了网页，同一快捷键会把焦点带回面板。点击扩展程序图标也能打开面板 — 可在浏览器的扩展程序菜单中固定它。
2. `↑` `↓` — 在列表中移动，`→` `←` — 展开和折叠文件夹，`Enter` — 打开。
3. `/` — 搜索：开始输入标题、网站或文件夹。
4. `空格` — 标记多个书签，`M` — 按名称将它们移动到文件夹。
5. `⌘K`/`Ctrl+K` — 命令面板：所有命令及其按键。
6. 右键点击书签、文件夹或空白处，会打开与浏览器相同的菜单；`Shift+F10` — 用键盘打开。
7. `i` — 帮助。添加新书签的方式与浏览器通常的方式一样 — `⌘D`/`Ctrl+D`。

## 默认按键

在 Windows 和 Linux 上，`⌘` 即 `Ctrl`。所有按键都可在设置中更改。

| 操作 | 按键 |
| --- | --- |
| 在列表中移动 / 展开、折叠文件夹 | `↑` `↓` / `→` `←`，`Home` `End` |
| 打开 / 在另一个标签页中打开 | `Enter` / `⌘Enter` |
| 让标签页回到书签网址 | `Shift+Enter` |
| 搜索书签 | `/`，`⌘F` |
| 命令面板 | `⌘K`，`?` |
| 打开菜单 | `Shift+F10` |
| 标记 / 连续标记 / 标记文件夹中的全部 | `空格` / `Shift+↑↓` / `⌘A` |
| 移动到文件夹… / 上移、下移 | `M` / `Alt+↑↓` |
| 新建文件夹、重命名、删除 | `N`，`R`（`F2`），`D` |
| 复制网址 / 保存标签页网址 | `C` / `U` |
| 剪切、复制、粘贴 | `⌘X`，`⌘C`，`⌘V` |
| 撤消 / 重做 | `⌘Z` / `⌘⇧Z`，`⌘Y` |
| 关闭书签的标签页 | `⌫`，`Delete` |
| 切换视图 / 帮助 / 设置 | `V` / `i`（`F1`）/ `,` |
| 取消或关闭：清除标记、退出搜索、关闭面板 | `Esc` |

## 隐私

扩展程序只在本地运行，不向网络发送任何内容：您的书签和历史记录都不会离开浏览器。设置保存在浏览器中扩展程序的本地存储里。所需权限用于书签、侧边栏、网站图标、标签页和标签页组（固定标签页模式和成组打开）以及保存设置。

## 翻译

界面和帮助跟随浏览器语言：English, Русский, Español, Português (Brasil), Français, Deutsch, 中文（简体）, 日本語, हिन्दी, العربية。其他语言显示英文。

想添加您的语言或修正翻译？请参阅 [TRANSLATING.md](TRANSLATING.md)（英文），或创建 [“Translation” issue](https://github.com/Airnook/bookmarks/issues/new?template=translation.yml)。

## 开发

纯 JavaScript（Manifest V3），无需构建：浏览器直接加载仓库根目录中的文件。

```sh
npm ci
npm run lint
npm test
npm run test:browser   # 在 Chromium 中运行冒烟测试：npx playwright install chromium
npm run package        # dist/airnook-bookmarks-<版本>.zip
```

架构、测试和发布流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE) © 2026 Airnook
