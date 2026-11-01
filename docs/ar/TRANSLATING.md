# ترجمة Bookmarks

[🇬🇧 English](../../.github/TRANSLATING.md) | [🇷🇺 Русский](../ru/TRANSLATING.md) | [🇪🇸 Español](../es/TRANSLATING.md) | [🇧🇷 Português (Brasil)](../pt-BR/TRANSLATING.md) | [🇫🇷 Français](../fr/TRANSLATING.md) | [🇩🇪 Deutsch](../de/TRANSLATING.md) | [🇨🇳 中文（简体）](../zh-CN/TRANSLATING.md) | [🇯🇵 日本語](../ja/TRANSLATING.md) | [🇮🇳 हिन्दी](../hi/TRANSLATING.md) | **🇸🇦 العربية**

تقع نصوص الواجهة في `_locales/<code>/messages.json` (تنسيق `chrome.i18n` القياسي في Chrome).
يتناول هذا الدليل هذا الملف فقط. يختار Chrome المجلد المطابق للغة المتصفح؛
وإن لم يوجد مجلد مطابق فيُستخدم النص الإنجليزي (`_locales/en`).

## إضافة لغة جديدة

1. اختر رمزًا من [قائمة لغات Chrome](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
   يتجاهل Chrome الرموز التي لا يدعمها. استخدم شرطة سفلية في اسم المجلد: `pt_BR` و`zh_CN` و`es_419`.
2. انسخ `_locales/en/messages.json` إلى `_locales/<code>/messages.json`.
3. اضبط `locale` على الرمز نفسه لكن بشرطة عادية: `pt-BR` و`zh-CN` و`es-419`.
4. اضبط `dir` على `ltr` أو `rtl`.
5. ترجم كل `message` ثم شغّل الفحوصات أدناه.

لا حاجة إلى تغيير الشيفرة: تعثر الاختبارات بنفسها على كل المجلدات في `_locales/`.

## المفاتيح والحقول

- **لا تغيّر أي مفتاح أبدًا** (الاسم الذي يسبق `"message"`). تستخدم الشيفرة هذه الأسماء.
- **`message`** — النص الذي تترجمه.
- **`description`** — سياق للمترجمين، مثل مكان ظهور النص. لا يظهر في الإضافة.
  في `en` تحتاج كل رسالة تحتوي على `placeholders` إلى وصف، بما في ذلك كل صيغة جمع (`_one` و`_other`…): اذكر أين يظهر النص وما هو كل `$NAME$`.
  يتحقق `npm test` من ذلك. يمكن للغات الأخرى تركه.
- **`locale`** — رمز لغة الملف. تُستمد منه صيغ الجمع و`lang` للصفحة.
- **`dir`** — `ltr` (من اليسار إلى اليمين) أو `rtl` (من اليمين إلى اليسار، مثل العربية والعبرية والفارسية والأردية).
  تأخذ الصفحات اتجاهها منه.

## العناصر النائبة

يُستبدل `$NAME$` في `message` بقيمة العنصر النائب الذي يحمل هذا الاسم.
احتفظ بالاسم وبعلامتي `$`، وانقل العنصر النائب إلى المكان الذي تحتاجه لغتك:

```json
"more_results": {
  "message": "$COUNT$ more — refine the search",
  "placeholders": {
    "count": { "content": "$1" }
  }
}
```

- استخدم أسماء العناصر النائبة نفسها الموجودة في `en`. يبقى `content` هو `$1` و`$2`… كما في `en`.
- لا تترجم النص الموجود داخل `$…$`.
- اكتب `$$` للحصول على علامة دولار حرفية.

## صيغ الجمع

للرسالة التي تحتوي على رقم مفتاح لكل فئة جمع في CLDR: ‏`<key>_one` و`<key>_few` و`<key>_many` و`<key>_other`.
استخدم فئات لغتك، وجميعها: تسردها [قواعد الجمع في CLDR](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
(للإنجليزية `one` و`other`؛ وللروسية `one` و`few` و`many` و`other`).
يفشل `npm test` إذا نقصت فئة، ويذكر المفاتيح الناقصة. الفئة `_other` مطلوبة.
لا تُبقِ مفتاحًا عاديًا (`bookmarks`) إلى جانب هذه الصيغ.

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

تستخدم الروسية (`ru`) للمفتاح نفسه `bookmarks_one` («$COUNT$ закладка») و`_few` («$COUNT$ закладки»)
و`_many` («$COUNT$ закладок») و`_other` («$COUNT$ закладки»).

## كلمات لوحة الأوامر (`cmd_*_words`)

لكل أمر `cmd_<id>` (اسمه)، واختياريًا `cmd_<id>_note` (سطر ثانٍ)، و`cmd_<id>_words`:
كلمات إضافية للبحث في اللوحة بلغتك، تُفصل بمسافات.
تُستخدم كلمات البحث الإنجليزية دائمًا أيضًا، لذلك تبقى `cmd_*_words` في `en` فارغة.
المفاتيح ذات القيم الفارغة مسموحة، لكن يجب أن تكون جميعها موجودة.

```json
"cmd_search_words": {
  "message": "найти фильтр",
  "description": "Extra words to find the command in the palette, in your language; the English words always work"
}
```

## الفحص محليًا

يتطلب Node.js ‏20.19+ أو 22.13+ أو 24+ (يستخدم CI الإصدار 22).

```sh
npm ci            # install dependencies
npm test          # checks every language in _locales/
npm run lint
npm run package   # builds dist/*.zip; _locales/ is included
```

يفحص `npm test` لكل لغة:

- المفاتيح نفسها الموجودة في `en` (بلا ناقص ولا زائد؛ وتُحسب صيغ الجمع مفتاحًا واحدًا)؛
- أن `locale` و`dir` مضبوطان، وأن `locale` يطابق اسم المجلد؛
- صيغ الجمع: كل فئة في اللغة موجودة، ولا فئات غيرها، والفئة `_other` موجودة؛
- أن العناصر النائبة تطابق `en`، وأن كل `content` هو `$1`…`$9`؛
- أن `en` يحتوي على `description` لكل رسالة فيها عناصر نائبة؛
- أن كل مفتاح تستخدمه الشيفرة موجود في `en`.

لرؤية الواجهة بلغتك، حمّل الإضافة غير المضغوطة في متصفح بهذه اللغة:

1. اضبط لغة واجهة المتصفح على لغتك (Chrome: الإعدادات ← اللغات؛ ثم أعد تشغيل المتصفح).
2. افتح `chrome://extensions` وفعّل «وضع المطوّر» («Developer mode») وانقر «تحميل إضافة غير مضغوطة» («Load unpacked») واختر جذر المستودع.
3. افتح اللوحة الجانبية وتحقق من النصوص وصيغ الجمع، ومن التخطيط في حالة `rtl`.

يفتح `npm run test:browser` (يتطلب `npx playwright install chromium`) صفحات المساعدة والخيارات واللوحة الجانبية في متصفح حقيقي،
مرة لكل مجلد لغة في `_locales/`، ومرة للعبرية (بلا ترجمة، فيظهر النص الإنجليزي)، ومرة لعبرية وهمية من اليمين إلى اليسار.
افحص لغتك وحدها أثناء العمل: `SMOKE_LOCALES=pt_BR npm run test:browser` (الأسماء مفصولة بفواصل: أسماء المجلدات و`he` و`he-rtl`).

## تحديث ترجمة موجودة

عندما تُضاف مفاتيح جديدة إلى `en` أو يتغير، يفشل `npm test` ويسرد المفاتيح الناقصة في كل لغة.
أضفها وترجمها ثم شغّل `npm test` مجددًا. احذف المفاتيح التي لم تعد موجودة في `en`.

## فتح pull request

1. أنشئ فرعًا من `dev` وأجرِ commit للملف `_locales/<code>/messages.json`.
2. شغّل الفحوصات أعلاه.
3. افتح pull request إلى `dev` (`gh pr create --base dev` أو من GitHub).
   اذكر في الوصف أي لغة هي، وهل هي جديدة أم تصحيح.
   للأسئلة والمشكلات: افتح issue باستخدام نموذج **Translation**.
