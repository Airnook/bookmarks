# المساهمة

[🇬🇧 English](../../.github/CONTRIBUTING.md) | [🇷🇺 Русский](../ru/CONTRIBUTING.md) | [🇪🇸 Español](../es/CONTRIBUTING.md) | [🇧🇷 Português (Brasil)](../pt-BR/CONTRIBUTING.md) | [🇫🇷 Français](../fr/CONTRIBUTING.md) | [🇩🇪 Deutsch](../de/CONTRIBUTING.md) | [🇨🇳 中文（简体）](../zh-CN/CONTRIBUTING.md) | [🇯🇵 日本語](../ja/CONTRIBUTING.md) | [🇮🇳 हिन्दी](../hi/CONTRIBUTING.md) | **🇸🇦 العربية**

الإضافة مكتوبة بجافاسكربت خالص (Manifest V3) ومن دون خطوة بناء: يحمّل المتصفح الملفات من جذر المستودع كما هي. تحمّل الصفحات
(`panel.html` و`options.html` و`help.html`) وحدات ES ‏(`<script type="module">`) باستيرادات صريحة؛ وما تشترك فيه موجود في
`commands.js`. أما السكربت الخلفي `background.js` فهو service worker عادي وليس وحدة. شيفرة اللوحة مقسّمة إلى وحدات في `panel/`؛
وبدء التشغيل وترتيب الاشتراك في الأحداث في `panel/main.js`، والحالة المتغيرة المشتركة في `panel/state.js`. نص الواجهة يقع في
`_locales/<اللغة>/messages.json` (‏`chrome.i18n` القياسي) ويعرضه `i18n.js` (‏`t` وصيغ الجمع واتجاه الصفحة). أدوات التطوير
(`package.json` و`eslint.config.js` و`test/` و`scripts/`) ليست جزءًا من الإصدار. ويقع في الجذر أيضًا السمة (`theme.js`، مشتركة بين اللوحة والإعدادات) وصيغة ملفات الإعدادات (`settings-file.js`: غلاف وسلسلة ترحيل حسب `format`، لاستيراد وتصدير الاختصارات والسمة).

### وحدات اللوحة

تستورد وحدات `panel/` بعضها بعضًا من الأعلى إلى الأسفل فقط ومن دون دورات — يتحقق `test/panel-imports.test.js` من ذلك
(ويطبع مسار الدورة إن وُجدت). الطبقات من الأسفل إلى الأعلى:

1. بلا اعتماد على اللوحة: ‏`demo` و`util` و`dom` و`url` و`search` و`place` (أين يستقر العنصر المنقول)، ثم `state` و`nodes` و`history`
   (سجل التعديلات للتراجع والإعادة: كل تغيير في الإشارات المرجعية يجري من اللوحة يمر عبر `begin()` فيه)؛
2. ‏`ui` (مربع التأكيد والرسائل والتركيز) و`keymap` (تلميحات المفاتيح) و`tree` (قراءة الشجرة وذاكرة العقد المؤقتة)؛
3. ‏`search-index` (فهرس البحث) و`tabs` و`marks` و`undo-buttons` (زرّا التراجع والإعادة في الترويسة)؛
4. ‏`render`، ثم `find` (دخول البحث والخروج منه) و`open` و`edit` و`palette` (الاختيار من قائمة)؛
5. ‏`move-to` و`link` و`search-input`؛
6. ‏`actions` (ما يفعله كل أمر)؛
7. ‏`keys` و`mouse` و`drag` (السحب والإفلات بالفأرة)، ثم `main`.

‏`demo` لا يعتمد على بقية وحدات اللوحة لكن يجب أن يكون أول استيراد في `main.js`: في وضع العرض التجريبي (`panel.html?demo`، معاينة السمة في الإعدادات) يستبدل `chrome` ببيانات ثابتة في الذاكرة قبل أن تقرأه أي وحدة أخرى.

لا تستورد الوحدة إلا من الطبقات الأدنى منها. وحين تحتاج وحدة سفلى إلى استدعاء وحدة أعلى فإنها لا تستوردها بل تتلقى الاستدعاء
من الخارج: يستدعي `tree` الدالة `onTreeApplied(callback)` بعد كل قراءة للشجرة (ويضبط `main.js` إعادة الرسم)، وينفّذ
`openPalette(run)` الأمر المختار عبر `run` الذي يُمرَّر إليه. والحالة التي تحتاجها طبقات عدة موجودة في `state` (مثل `state.pending`
— تسلسل مفاتيح جارٍ: يديره `keys` ويلغيه `palette` أيضًا). لا توجد ناقلة أحداث: يُضبط الاستدعاء المرتد صراحةً في موضع واحد عند
بدء التشغيل. ويحدد `main.js` ترتيب الاشتراك في الأحداث، وهو مهم حين تستمع عدة معالجات إلى الحدث نفسه.

## التطوير

يلزم Node.js ‏20.19+ أو 22.13+ أو 24+ (متطلب من ESLint 10).

```sh
npm ci            # install dependencies
npm run lint      # ESLint
npm test          # tests (node --test)
npm run package   # build dist/airnook-bookmarks-<version>.zip and check the archive
npm run test:browser  # smoke test in Chromium (needs npx playwright install chromium)
```

لتشغيل الإضافة: `chrome://extensions` ← «وضع المطوّر» ← «تحميل إضافة غير مضغوطة» ← جذر المستودع.

### المدقّق (Linter)

الصفحات وحدات ES: كل ما يأخذه ملف من ملف آخر (‏`COMMANDS` و`chordOf` من `commands.js` وغيرهما) يستورده صراحةً، وإلا أبلغ المدقّق عن
اسم غير معروف. ولا يسمح المدقّق بـ `catch {}` فارغة: اكتب بداخلها سبب جواز تجاهل الخطأ.

### الاختبارات

تستورد الاختبارات الوحدات التي لا تحتاج DOM مباشرةً (‏`commands.js` والدوال الصرفة للوحة في `panel/`). و`background.js` ليس وحدة،
لذا تحمّله الاختبارات عبر `node:vm` مع بديل لـ `chrome` (انظر `test/load.js`)؛ وتُحمَّل صفحة الخيارات أيضًا عبر `node:vm` مع بدائل لـ DOM
(انظر `test/options-page.js`).

يبني `npm run test:browser` الأرشيف ويحمّل الإضافة في Chromium الخاص بـ Playwright ويتحقق من الصفحات ومن المفاتيح الرئيسية للوحة:
تشغيل لكل لغة في `_locales/`، إضافةً إلى العبرية بلا ترجمة وعبرية وهمية من اليمين إلى اليسار. لبعض اللغات فقط:
`SMOKE_LOCALES=ru,en npm run test:browser` (الأسماء هي مجلدات `_locales` و`he` و`he-rtl`). وهو ليس جزءًا من `npm test` أو CI: فقد لا
يوجد متصفح هناك.

### التغليف

محتوى الأرشيف هو إغلاق للمراجع: ‏`manifest.json` ← كل ما يشير إليه (service worker والصفحات والأيقونات) ← لكل صفحة html:
‏`<script src>` و`<link href>` و`<img src>` فيها، ولكل سكربت: ‏`import` الثابتة و`export … from` فيه ← بشكل تراجعي. يضاف إلى ذلك
مجلد `_locales/` إن وُجد، وصفحات `EXTRA_PAGES` في `scripts/package.mjs`: تفتحها الشيفرة بالاسم (مثل `help.html`)، فلا تجدها المراجع.
ولا يدخل الأرشيفَ شيء غير ذلك، بما في ذلك أي ملفات مساعدة جديدة في الجذر.

إذا أصبح في ملف `.js` للإضافة إشارة إلى صفحة html جديدة غير موجودة في الأرشيف فسيفشل البناء مع تلميح بإضافتها إلى `EXTRA_PAGES`.
بعد البناء يتأكد فحص منفصل من خلو الأرشيف من `package.json` وإعدادات المدقّق و`test/` و`scripts/` و`.github/` و`README*.md` و`docs/`
(صور README) و`LICENSE` و`TODO.md` و`CONTRIBUTING*.md` والملفات المخفية، ومن وجود كل المراجع؛ وعند الخطأ ينتهي الأمر برمز غير صفري.

ينفّذ CI (‏`.github/workflows/ci.yml`) الأمر نفسه عند كل push وpull request إلى `main`.

## الترجمات

ترجمة الواجهة موجودة في `_locales/<اللغة>/messages.json`. طريقة إضافة لغة أو تصحيح ترجمة، وما يفحصه `npm test`،
موصوفة في [TRANSLATING.md](TRANSLATING.md). يُكتشف أي مجلد جديد في `_locales/` تلقائيًا؛ ولا حاجة إلى تغيير الشيفرة.

## الإصدار

1. ارفع `version` في `manifest.json` وادمج التغيير في `main`.
2. على `main` أنشئ الوسم `vX.Y.Z`، حيث `X.Y.Z` هو بالضبط الإصدار الموجود في `manifest.json`:

   ```sh
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. يتحقق سير العمل `release.yml` من أن الوسم يطابق الإصدار، ويشغّل lint والاختبارات، ويبني الأرشيف وينشر
   GitHub Release يتضمن `airnook-bookmarks-X.Y.Z.zip`.

إذا لم يتطابق الوسم مع الإصدار فسيفشل سير العمل قبل البناء: احذف الوسم
(`git push --delete origin vX.Y.Z`) وصحّح الإصدار وأعد المحاولة.
