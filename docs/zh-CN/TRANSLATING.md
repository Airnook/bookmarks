# 翻译 Bookmarks

[🇬🇧 English](../../.github/TRANSLATING.md) | [🇷🇺 Русский](../ru/TRANSLATING.md) | [🇪🇸 Español](../es/TRANSLATING.md) | [🇧🇷 Português (Brasil)](../pt-BR/TRANSLATING.md) | [🇫🇷 Français](../fr/TRANSLATING.md) | [🇩🇪 Deutsch](../de/TRANSLATING.md) | **🇨🇳 中文（简体）** | [🇯🇵 日本語](../ja/TRANSLATING.md) | [🇮🇳 हिन्दी](../hi/TRANSLATING.md) | [🇸🇦 العربية](../ar/TRANSLATING.md)

界面文本位于 `_locales/<code>/messages.json`（Chrome 标准的 `chrome.i18n` 格式）。
本指南只涉及这个文件。Chrome 会选择与浏览器语言匹配的文件夹；
如果没有，则使用英文文本（`_locales/en`）。

## 添加新语言

1. 从 [Chrome 语言区域列表](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales)中选择一个代码。
   Chrome 会忽略它不支持的代码。文件夹名称中使用下划线：`pt_BR`、`zh_CN`、`es_419`。
2. 将 `_locales/en/messages.json` 复制为 `_locales/<code>/messages.json`。
3. 将 `locale` 设为相同的代码，但使用连字符：`pt-BR`、`zh-CN`、`es-419`。
4. 将 `dir` 设为 `ltr` 或 `rtl`。
5. 翻译每一个 `message`，然后运行下面的检查。

无需修改代码：测试会自动找到 `_locales/` 中的所有文件夹。

## 键和字段

- **不要修改键**（`"message"` 之前的名称）。代码使用这些名称。
- **`message`** — 需要翻译的文本。
- **`description`** — 给译者的上下文，例如文本出现的位置。扩展中不会显示它。
  在 `en` 中，每条带有 `placeholders` 的消息都需要一条，包括每种复数形式（`_one`、`_other`……）：说明文本显示在哪里，以及每个 `$NAME$` 是什么。
  `npm test` 会检查这一点。其他语言可以省略。
- **`locale`** — 文件的语言代码。复数形式和页面的 `lang` 都由它决定。
- **`dir`** — `ltr`（从左到右）或 `rtl`（从右到左，例如阿拉伯语、希伯来语、波斯语、乌尔都语）。
  页面据此确定文字方向。

## 占位符

`message` 中的 `$NAME$` 会被同名占位符的值替换。
保留名称和 `$` 符号，并把占位符移到你的语言需要的位置：

```json
"more_results": {
  "message": "$COUNT$ more — refine the search",
  "placeholders": {
    "count": { "content": "$1" }
  }
}
```

- 使用与 `en` 相同的占位符名称。`content` 与 `en` 一样保持 `$1`、`$2`……
- 不要翻译 `$…$` 内的文本。
- 需要字面的美元符号时写 `$$`。

## 复数形式

带数字的消息，每个 CLDR 复数类别对应一个键：`<key>_one`、`<key>_few`、`<key>_many`、`<key>_other`。
使用你的语言所具有的全部类别：[CLDR 复数规则](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
列出了它们（英语有 `one` 和 `other`；俄语有 `one`、`few`、`many`、`other`）。
缺少某个类别时 `npm test` 会失败，并指出缺少的键。`_other` 必不可少。
不要在这些形式旁边保留不带后缀的键（`bookmarks`）。

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

同一个键在俄语（`ru`）中使用 `bookmarks_one`（“$COUNT$ закладка”）、`_few`（“$COUNT$ закладки”）、
`_many`（“$COUNT$ закладок”）、`_other`（“$COUNT$ закладки”）。

## 命令面板词汇（`cmd_*_words`）

每个命令都有 `cmd_<id>`（名称），可选的 `cmd_<id>_note`（第二行）和 `cmd_<id>_words`：
用你的语言写的、用于在面板中搜索的额外词语，以空格分隔。
英文搜索词始终也会生效，因此 `en` 中的 `cmd_*_words` 为空。
允许值为空的键，但所有键都必须存在。

```json
"cmd_search_words": {
  "message": "найти фильтр",
  "description": "Extra words to find the command in the palette, in your language; the English words always work"
}
```

## 本地检查

需要 Node.js 20.19+、22.13+ 或 24+（CI 使用 22）。

```sh
npm ci            # install dependencies
npm test          # checks every language in _locales/
npm run lint
npm run package   # builds dist/*.zip; _locales/ is included
```

`npm test` 对每种语言检查：

- 键与 `en` 相同（不缺少也没有多余；复数形式算作一个键）；
- 已设置 `locale` 和 `dir`，且 `locale` 与文件夹名称一致；
- 复数形式：该语言的每个类别都存在，没有其他类别，且有 `_other`；
- 占位符与 `en` 一致，且每个 `content` 为 `$1`…`$9`；
- `en` 中每条带占位符的消息都有 `description`；
- 代码使用的每个键都存在于 `en` 中。

要查看你的语言下的界面，请在使用该语言的浏览器中加载解压的扩展：

1. 把浏览器的界面语言设为你的语言（Chrome：设置 → 语言；重启浏览器）。
2. 打开 `chrome://extensions`，开启“开发者模式”（“Developer mode”），点击“加载已解压的扩展程序”（“Load unpacked”），选择仓库根目录。
3. 打开侧边栏，检查文本、复数形式，以及 `rtl` 时的布局。

`npm run test:browser`（需要 `npx playwright install chromium`）会在真实浏览器中打开帮助、选项和侧边栏页面，
`_locales/` 中的每个语言文件夹各一次，希伯来语（没有翻译，因此显示英文文本）一次，以及虚拟的从右到左希伯来语一次。
开发时只检查你的语言：`SMOKE_LOCALES=pt_BR npm run test:browser`（名称以逗号分隔：文件夹名称、`he`、`he-rtl`）。

## 更新现有翻译

当 `en` 新增键或发生变化时，`npm test` 会失败，并列出每种语言中缺少的键。
添加并翻译它们，然后再次运行 `npm test`。删除 `en` 中已不存在的键。

## 提交 pull request

1. 从 `dev` 创建分支，提交 `_locales/<code>/messages.json`。
2. 运行上面的检查。
3. 向 `dev` 提交 pull request（`gh pr create --base dev`，或在 GitHub 上）。
   在描述中说明是哪种语言，以及是新增还是修正。
   有疑问或问题：使用 **Translation** 表单提交 issue。
