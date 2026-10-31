// Переводы: полнота каждого _locales/<язык>/messages.json относительно запасного языка,
// формы множественного числа, плейсхолдеры, ключи, которые использует код.
// Новый язык проверяется сам — достаточно добавить его каталог.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LOCALE, locales, readMessages, useLocale } from './i18n-stub.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const PLURAL = new RegExp(`^(.+)_(${CATEGORIES.join('|')})$`);
// Базовый ключ: у форм множественного числа — без суффикса категории
const baseOf = (key) => key.match(PLURAL)?.[1] ?? key;
const lower = (messages) => Object.fromEntries(Object.entries(messages).map(([k, v]) => [k.toLowerCase(), v]));
const usedNames = (message) => new Set([...message.replaceAll('$$', '').matchAll(/\$([\w@]+)\$/g)].map(m => m[1].toLowerCase()));
const definedOf = (entry) => Object.fromEntries(Object.entries(entry.placeholders ?? {}).map(([n, p]) => [n.toLowerCase(), p.content]));
// Плейсхолдеры базового ключа (у множественного числа — всех форм вместе)
function placeholdersByBase(messages) {
  const out = new Map();
  for (const [key, entry] of Object.entries(lower(messages))) {
    const base = baseOf(key);
    const acc = out.get(base) ?? { used: new Set(), defined: {} };
    usedNames(entry.message).forEach(n => acc.used.add(n));
    Object.assign(acc.defined, definedOf(entry));
    out.set(base, acc);
  }
  return out;
}

const fallback = readMessages(DEFAULT_LOCALE);
const fallbackKeys = new Set(Object.keys(fallback).map(k => k.toLowerCase()));

test('переводы: есть запасной язык и хотя бы ещё один', () => {
  assert.ok(locales().includes(DEFAULT_LOCALE));
  assert.ok(locales().length > 1, String(locales()));
});

// Переводчику нужно знать, что подставится в $NAME$: у каждой формы (в т.ч. _one, _other)
test(`${DEFAULT_LOCALE}: у каждого сообщения с плейсхолдерами есть description`, () => {
  const missing = Object.entries(fallback).filter(([, e]) => e.placeholders && !e.description?.trim()).map(([k]) => k);
  assert.deepEqual(missing, [], `${DEFAULT_LOCALE}: без description (переводчику не сказано, что подставится): ${missing.join(', ')}`);
});

for (const lang of locales()) {
  const messages = readMessages(lang);

  test(`${lang}: ключи, сообщения и код языка`, () => {
    const keys = Object.keys(messages);
    for (const key of keys) {
      assert.match(key, /^[A-Za-z0-9_]+$/, `${lang}: недопустимый ключ ${key}`);
      assert.equal(typeof messages[key].message, 'string', `${lang}: ${key} без message`);
    }
    assert.equal(new Set(keys.map(k => k.toLowerCase())).size, keys.length, `${lang}: ключи совпадают без учёта регистра`);
    // код языка сообщений — по нему выбираются формы множественного числа и <html lang>
    const locale = messages.locale?.message;
    assert.equal(locale, lang.replace('_', '-'), `${lang}: locale`);
    assert.deepEqual(Intl.PluralRules.supportedLocalesOf(locale), [locale], `${lang}: Intl не знает ${locale}`);
    // направление страниц на этом языке
    assert.ok(['ltr', 'rtl'].includes(messages.dir?.message), `${lang}: dir — ltr или rtl`);
  });

  test(`${lang}: множественное число — все категории языка, только они; _other обязателен`, () => {
    const allowed = new Intl.PluralRules(messages.locale.message).resolvedOptions().pluralCategories;
    const forms = new Map();
    for (const key of Object.keys(messages)) {
      const m = key.match(PLURAL);
      if (m) forms.set(m[1], [...(forms.get(m[1]) ?? []), m[2]]);
    }
    for (const [base, cats] of forms) {
      assert.ok(cats.includes('other'), `${lang}: у ${base} нет ${base}_other`);
      for (const c of cats) assert.ok(allowed.includes(c), `${lang}: ${base}_${c} — в языке нет категории ${c} (есть: ${allowed})`);
      // полнота — у сообщений с числом (код выводит их через plural); обычное «…_other» — не форма
      const missing = allowed.filter(c => !cats.includes(c)).map(c => `${base}_${c}`);
      if (pluralKeys.has(base.toLowerCase())) assert.ok(!missing.length, `${lang}: у ${base} нет форм ${missing.join(', ')} (для ${messages.locale.message} нужны: ${allowed.join(', ')})`);
      assert.ok(!(base in messages), `${lang}: ${base} — и обычное сообщение, и формы множественного числа`);
    }
  });

  test(`${lang}: плейсхолдеры определены и совпадают с ${DEFAULT_LOCALE}`, () => {
    for (const [key, entry] of Object.entries(lower(messages))) {
      const defined = definedOf(entry);
      for (const name of usedNames(entry.message)) assert.ok(name in defined, `${lang}: в ${key} нет плейсхолдера $${name}$`);
      for (const content of Object.values(defined)) assert.match(content, /^\$[1-9]$/, `${lang}: ${key}: content плейсхолдера — $1…$9`);
    }
    const own = placeholdersByBase(messages);
    const base = placeholdersByBase(fallback);
    for (const [key, { used, defined }] of own) {
      if (!base.has(key)) continue; // лишние ключи — в тесте полноты
      assert.deepEqual([...used].sort(), [...base.get(key).used].sort(), `${lang}: ${key}: плейсхолдеры`);
      assert.deepEqual(defined, base.get(key).defined, `${lang}: ${key}: подстановки плейсхолдеров`);
    }
  });

  if (lang !== DEFAULT_LOCALE) {
    test(`${lang}: те же ключи, что в ${DEFAULT_LOCALE} (без учёта форм множественного числа)`, () => {
      const bases = (m) => new Set(Object.keys(m).map(k => baseOf(k.toLowerCase())));
      const own = bases(messages);
      const want = bases(fallback);
      assert.deepEqual([...want].filter(k => !own.has(k)), [], `${lang}: нет перевода`);
      assert.deepEqual([...own].filter(k => !want.has(k)), [], `${lang}: лишние ключи`);
    });
  }
}

// Файлы расширения, где код или разметка ссылаются на сообщения
const sources = () => [
  ...fs.readdirSync(root).filter(f => /\.(js|html)$/.test(f) && f !== 'eslint.config.js'),
  ...fs.readdirSync(path.join(root, 'panel')).filter(f => f.endsWith('.js')).map(f => `panel/${f}`),
  'manifest.json',
];

// Ключи, которые код выводит через plural('<ключ>', n) — у них формы множественного числа
const pluralKeys = new Set();
for (const file of sources()) {
  for (const m of read(file).matchAll(/\bplural\(\s*'([^']+)'/g)) pluralKeys.add(m[1].toLowerCase());
}

test(`ключи из кода и разметки есть в ${DEFAULT_LOCALE}`, () => {
  const missing = [];
  let count = 0;
  for (const file of sources()) {
    const text = read(file);
    const keys = [
      // только ключ целиком: t('group_' + g) собирает ключ — такие проверяет тест команд
      ...[...text.matchAll(/\bt\(\s*'([^']+)'\s*[,)]/g)].map(m => m[1]),
      ...[...text.matchAll(/\bplural\(\s*'([^']+)'\s*[,)]/g)].map(m => `${m[1]}_other`),
      ...[...text.matchAll(/\bdata-i18n(?:-[\w-]+)?="([^"]+)"/g)].map(m => m[1]),
      ...[...text.matchAll(/__MSG_(\w+)__/g)].map(m => m[1]),
    ];
    count += keys.length;
    for (const key of keys) if (!key.startsWith('@@') && !fallbackKeys.has(key.toLowerCase())) missing.push(`${file}: ${key}`);
  }
  assert.ok(count > 100, `найдено ссылок на сообщения: ${count}`);
  assert.deepEqual(missing, []);
});

test('команды: названия на всех языках; лишних cmd_ и group_ нет', async () => {
  for (const lang of locales()) {
    useLocale(lang);
    // свежая копия модуля: названия команд читаются при загрузке
    const { COMMANDS, groupTitle } = await import(`../commands.js?${lang}`);
    for (const c of COMMANDS) {
      assert.ok(c.title, `${lang}: нет названия ${c.id}`);
      assert.ok(groupTitle(c.group), `${lang}: нет названия группы ${c.group}`);
    }
    if (lang !== DEFAULT_LOCALE) continue;
    const known = new Set(COMMANDS.flatMap(c => {
      const key = 'cmd_' + c.id.replaceAll('.', '_').toLowerCase();
      return [key, `${key}_note`, `${key}_words`, `group_${c.group}`];
    }));
    const stale = [...fallbackKeys].filter(k => /^(cmd|group)_/.test(k) && !known.has(k));
    assert.deepEqual(stale, [], 'сообщения команд, которых нет в реестре');
  }
});

test('plural: ru — формы для 1, 2, 5, 11, 21, 22, 25; en — 1 и 2', async () => {
  const { plural, isolate } = await import('../i18n.js');
  useLocale('ru');
  const ru = { 1: 'закладка', 2: 'закладки', 5: 'закладок', 11: 'закладок', 21: 'закладка', 22: 'закладки', 25: 'закладок' };
  // подстановки изолированы (FSI … PDI), в том числе число
  for (const [n, form] of Object.entries(ru)) assert.equal(plural('bookmarks', +n), `${isolate(n)} ${form}`);
  assert.equal(plural('open_tabs_already', 21), `(${isolate(21)} уже открыта)`);
  assert.equal(plural('moved_items', 3, 'Работа'), `Перемещено ${isolate(3)} элемента в «${isolate('Работа')}»`);
  useLocale('en');
  assert.equal(plural('bookmarks', 1), `${isolate(1)} bookmark`);
  assert.equal(plural('bookmarks', 2), `${isolate(2)} bookmarks`);
});

test('plural: язык браузера без перевода — сообщения и правила запасного языка', async () => {
  const { plural, t, isolate } = await import('../i18n.js');
  useLocale('uk'); // у украинского свои формы, но показан английский текст
  assert.equal(t('locale'), DEFAULT_LOCALE);
  assert.equal(plural('bookmarks', 2), `${isolate(2)} bookmarks`);
  assert.equal(plural('bookmarks', 21), `${isolate(21)} bookmarks`);
});
