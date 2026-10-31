// Перевод интерфейса: сообщения из _locales/<язык>/messages.json (стандартный chrome.i18n).
// Браузер сам выбирает язык; если перевода на язык браузера нет — английский (default_locale).
//
// Множественное число: в messages.json его нет, поэтому у сообщения с числом несколько
// ключей по категориям CLDR — <ключ>_one, <ключ>_few, <ключ>_many, <ключ>_other (в каждом
// языке — все нужные ему, _other обязателен; test/locales.test.js проверяет полноту). Категорию выбирает Intl.PluralRules
// по языку сообщений, которые реально показаны: его код лежит в каждом messages.json под
// ключом locale, поэтому при запасном английском и правила английские.
//
// Направление страниц (ltr/rtl) — тоже из показанного перевода, ключ dir: при языке браузера
// справа налево без перевода английский текст остаётся слева направо.
//
// Страницы: статический текст — в атрибутах data-i18n (текст элемента), data-i18n-title,
// data-i18n-placeholder, data-i18n-aria-label; заполняет их localizePage. Если внутри
// элемента с data-i18n есть другие элементы (кнопка, клавиша), сообщение ставит их
// на места $1, $2… (placeholders) — по порядку, сами элементы переводятся своими атрибутами.

// Подстановка (имя папки, число) — текст другого направления: в арабской фразе латиница
// ломает порядок кавычек и знаков. FSI … PDI изолируют её от окружения.
// Строка, которую читает код (ключ, сравнение, хранение), — без подстановок или через message.
export const isolate = (s) => `⁨${s}⁩`;
const message = (key, subs) => chrome.i18n.getMessage(key, subs.map(String));
export const t = (key, ...subs) => message(key, subs.map((s) => isolate(String(s))));

const rules = new Map();
const pluralRules = (locale) => rules.get(locale) ?? rules.set(locale, new Intl.PluralRules(locale)).get(locale);

// Сообщение с числом: n — первая подстановка ($1), остальные — следом
export function plural(key, n, ...subs) {
  const category = pluralRules(t('locale') || 'en').select(n);
  return t(`${key}_${category}`, n, ...subs) || t(`${key}_other`, n, ...subs);
}

const ATTRS = ['title', 'placeholder', 'aria-label'];
// Метки мест для вложенных элементов: символы из области для частного использования
const MARK = 0xE000;

function fill(el, key) {
  const children = [...el.children];
  if (!children.length) return void (el.textContent = t(key));
  // метки — не текст: без изоляции, иначе FSI/PDI попали бы в текст между элементами
  const text = message(key, children.map((_, i) => String.fromCharCode(MARK + i)));
  // split с группой: нечётные куски — метки
  el.replaceChildren(...text.split(/([-])/).map((part, i) => (i % 2 ? children[part.charCodeAt(0) - MARK] : part)).filter(Boolean));
}

// Язык и направление страницы, весь статический текст. Пока dir не выставлен,
// страница скрыта (base.css): без мелькания непереведённого и смены направления.
export function localizePage() {
  for (const el of document.querySelectorAll('[data-i18n]')) fill(el, el.dataset.i18n);
  for (const attr of ATTRS) {
    for (const el of document.querySelectorAll(`[data-i18n-${attr}]`)) el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
  }
  document.documentElement.lang = t('locale');
  document.documentElement.dir = t('dir') || 'ltr';
}
