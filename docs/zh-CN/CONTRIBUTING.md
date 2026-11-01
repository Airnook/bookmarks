# 参与贡献

[🇬🇧 English](../../.github/CONTRIBUTING.md) | [🇷🇺 Русский](../ru/CONTRIBUTING.md) | [🇪🇸 Español](../es/CONTRIBUTING.md) | [🇧🇷 Português (Brasil)](../pt-BR/CONTRIBUTING.md) | [🇫🇷 Français](../fr/CONTRIBUTING.md) | [🇩🇪 Deutsch](../de/CONTRIBUTING.md) | **🇨🇳 中文（简体）** | [🇯🇵 日本語](../ja/CONTRIBUTING.md) | [🇮🇳 हिन्दी](../hi/CONTRIBUTING.md) | [🇸🇦 العربية](../ar/CONTRIBUTING.md)

该扩展是纯 JavaScript（Manifest V3），没有构建步骤：浏览器直接加载仓库根目录中的文件。页面（`panel.html`、
`options.html`、`help.html`）通过显式导入加载 ES 模块（`<script type="module">`）；它们共用的内容在 `commands.js` 中。
后台脚本 `background.js` 是普通的 service worker，不是模块。侧边栏代码拆分为 `panel/` 中的模块；启动和事件订阅的顺序在
`panel/main.js` 中，共享的可变状态在 `panel/state.js` 中。界面文本位于 `_locales/<语言>/messages.json`（标准的
`chrome.i18n`），由 `i18n.js` 显示（`t`、复数、页面方向）。开发工具（`package.json`、`eslint.config.js`、`test/`、
`scripts/`）不属于发布内容。 根目录中还有主题（`theme.js`，侧边栏和设置共用）以及设置文件格式（`settings-file.js`：信封和按 `format` 的迁移链，用于快捷键和主题的导入导出）。

### 侧边栏模块

`panel/` 中的模块之间只能自上而下地相互导入，不允许循环——`test/panel-imports.test.js` 会检查这一点（如有循环，会打印
循环路径）。各层自下而上如下：

1. 不依赖侧边栏的其他部分：`demo`、`util`、`dom`、`url`、`search`、`place`（被移动的项目落在何处），然后是 `state`、`nodes`、
   `history`（用于撤销和重做的编辑历史：从侧边栏对书签做的每一次更改都经过它的 `begin()`）；
2. `ui`（确认对话框、消息、焦点）、`keymap`（按键提示）、`tree`（读取树、节点缓存）；
3. `search-index`（搜索索引）、`tabs`、`marks`、`undo-buttons` （头部的撤销和重做按钮）；
4. `render`，然后是 `find`（进入和退出搜索）、`open`、`edit`、`palette`（从列表中选择）；
5. `move-to`、`link`、`search-input`；
6. `actions`（每个命令的具体行为）；
7. `keys`、`mouse`、`drag`（鼠标拖放），然后是 `main`。

`demo` 不依赖侧边栏的其他模块，但必须是 `main.js` 的第一个导入：在演示模式（`panel.html?demo`，设置中的主题预览）下，它会在其他模块读取 `chrome` 之前，将其替换为内存中的固定数据。

模块只从其下层导入。当下层模块需要调用上层模块时，不导入它，而是从外部接收这个调用：`tree` 在每次读取树之后调用
`onTreeApplied(callback)`（`main.js` 设置重绘），`openPalette(run)` 通过传入的 `run` 运行所选命令。多个层都需要的状态放在
`state` 中（例如 `state.pending`——正在进行的按键序列：由 `keys` 驱动，`palette` 也会取消它）。没有事件总线：回调在启动时
于同一处显式设置。`main.js` 决定事件订阅的顺序，当多个处理程序监听同一事件时，这个顺序很重要。

## 开发

需要 Node.js 20.19+、22.13+ 或 24+（ESLint 10 的要求）。

```sh
npm ci            # install dependencies
npm run lint      # ESLint
npm test          # tests (node --test)
npm run package   # build dist/airnook-bookmarks-<version>.zip and check the archive
npm run test:browser  # smoke test in Chromium (needs npx playwright install chromium)
```

运行扩展：`chrome://extensions` →“开发者模式”→“加载已解压的扩展程序”→ 仓库根目录。

### 代码检查（Linter）

页面是 ES 模块：文件从其他文件取用的任何内容（`commands.js` 中的 `COMMANDS`、`chordOf` 等）都必须显式导入，否则 linter 会
报告未知名称。linter 不允许空的 `catch {}`：请在其中写明为什么可以忽略该错误。

### 测试

测试直接导入不依赖 DOM 的模块（`commands.js`、`panel/` 中的纯侧边栏函数）。`background.js` 不是模块，因此测试通过
`node:vm` 并配合 `chrome` 桩来加载它（见 `test/load.js`）；选项页同样通过 `node:vm` 并配合 DOM 桩来加载（见
`test/options-page.js`）。

`npm run test:browser` 会构建压缩包，把扩展加载到 Playwright 的 Chromium 中，并检查各页面和侧边栏的主要按键：对
`_locales/` 中的每种语言各运行一次，另加没有翻译的希伯来语和虚拟的从右到左希伯来语。只测部分语言：
`SMOKE_LOCALES=ru,en npm run test:browser`（名称为 `_locales` 的文件夹、`he`、`he-rtl`）。它不属于 `npm test` 或 CI：那里
可能没有浏览器。

### 打包

压缩包的内容是引用的闭包：`manifest.json` → 它引用的一切（service worker、页面、图标）→ 对每个 html 页面，是其
`<script src>`、`<link href>` 和 `<img src>`；对每个脚本，是其静态 `import` 和 `export … from` → 递归。再加上
`_locales/` 文件夹（如果存在），以及 `scripts/package.mjs` 中 `EXTRA_PAGES` 里的页面：代码按名称打开这些页面（例如
`help.html`），所以引用找不到它们。其余任何内容，包括根目录中任何新增的辅助文件，都不会进入压缩包。

如果扩展的 `.js` 新增了对某个不在压缩包中的 html 页面的引用，构建会失败，并提示把它加入 `EXTRA_PAGES`。构建之后，
另一项检查会确认压缩包中没有 `package.json`、linter 配置、`test/`、`scripts/`、`.github/`、`README*.md`、`docs/`（README
的图片）、`LICENSE`、`TODO.md`、`CONTRIBUTING*.md` 或隐藏文件，并且所有引用都在；出错时命令以非零退出码结束。

CI（`.github/workflows/ci.yml`）在每次推送以及向 `main` 的 pull request 时执行同样的操作。

## 翻译

界面翻译位于 `_locales/<语言>/messages.json`。如何添加语言或修正翻译，以及 `npm test` 检查什么，见
[TRANSLATING.md](TRANSLATING.md)。`_locales/` 中的新文件夹会被自动识别；无需修改代码。

## 发布

1. 提高 `manifest.json` 中的 `version`，并将该更改合并到 `main`。
2. 在 `main` 上创建标签 `vX.Y.Z`，其中 `X.Y.Z` 必须与 `manifest.json` 中的版本完全一致：

   ```sh
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. `release.yml` 工作流会检查标签是否与版本一致，运行 lint 和测试，构建压缩包，并发布包含
   `airnook-bookmarks-X.Y.Z.zip` 的 GitHub Release。

如果标签与版本不一致，工作流会在构建之前失败：删除该标签（`git push --delete origin vX.Y.Z`），修正版本后重试。
