// Тема панели: объект настроек → CSS (theme.js). Умолчания — сегодняшний вид, поэтому без переопределений.
import test from 'node:test';
import assert from 'node:assert/strict';
import { THEME_DEFAULTS, cleanTheme, themeCss } from '../theme.js';

// Значение свойства в первом правиле :root (до @media)
const prop = (css, name) => css.split('@media')[0].match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();

test('тема по умолчанию ничего не меняет: панель выглядит как в 2.6.0', () => {
  assert.equal(themeCss(THEME_DEFAULTS), '');
  assert.equal(themeCss(undefined), '');
  assert.equal(themeCss({}), '');
});

test('режим: светлый и тёмный задают color-scheme, системный — нет', () => {
  assert.equal(prop(themeCss({ mode: 'light' }), 'color-scheme'), 'light');
  assert.equal(prop(themeCss({ mode: 'dark' }), 'color-scheme'), 'dark');
  assert.equal(prop(themeCss({ mode: 'sepia' }), 'color-scheme'), undefined);
});

test('цвета задаются для светлой и тёмной темы отдельно; незаданный остаётся прежним', () => {
  const css = themeCss({ colors: { light: { accent: '#FF0000' }, dark: { background: '#101010', text: '#f0f0f0' } } });
  assert.equal(prop(css, '--accent'), 'light-dark(#FF0000, #7ea6ff)');
  assert.equal(prop(css, '--bg'), 'light-dark(Canvas, #101010)');
  assert.equal(prop(css, '--text'), 'light-dark(#1d1f23, #f0f0f0)');
  // приглушённый текст — из своего цвета текста, в другой теме прежний
  assert.equal(prop(css, '--muted'), 'light-dark(#6c717a, color-mix(in srgb, #f0f0f0 62%, transparent))');
});

test('галочка отметки — цвета акцента своей темы', () => {
  const light = themeCss({ colors: { light: { accent: '#ff0000' } } });
  assert.match(prop(light, '--check'), /stroke='%23ff0000'/);
  assert.match(light.split('@media (prefers-color-scheme: dark)')[1], /stroke='%237ea6ff'/);
  // тёмная тема при светлой системе: галочка тёмной темы без @media
  const dark = themeCss({ mode: 'dark' });
  assert.match(prop(dark, '--check'), /stroke='%237ea6ff'/);
  assert.doesNotMatch(dark, /@media/);
});

test('цвет не в виде #rrggbb не попадает в CSS', () => {
  assert.equal(themeCss({ colors: { light: { accent: 'red; } body { display: none' } } }), '');
});

test('шрифт: свой — перед системным; символы, ломающие CSS, выброшены', () => {
  assert.equal(prop(themeCss({ font: ' Georgia ' }), '--font'), 'Georgia, system-ui, -apple-system, "Segoe UI", sans-serif');
  const evil = themeCss({ font: 'X; } body { color: red' });
  assert.match(evil, /^:root \{ --font: X +body +color: red, system-ui/);
  assert.equal(evil.match(/[;{}]/g).join(''), '{;}');
  assert.equal(themeCss({ font: '   ' }), '');
});

test('размер шрифта: 10–24 px, за границами — ближайшая; «как в браузере»', () => {
  assert.equal(prop(themeCss({ fontSize: 16 }), '--font-size'), '16px');
  assert.equal(prop(themeCss({ fontSize: 4 }), '--font-size'), '10px');
  assert.equal(prop(themeCss({ fontSize: 99 }), '--font-size'), '24px');
  assert.equal(prop(themeCss({ fontSize: 'browser' }), '--font-size'), 'medium');
  assert.equal(themeCss({ fontSize: 'big' }), '');
});

test('скругление: 0–16 px, за границами — ближайшая; «полное»', () => {
  assert.equal(prop(themeCss({ radius: 0 }), '--radius'), '0px');
  assert.equal(prop(themeCss({ radius: 40 }), '--radius'), '16px');
  assert.equal(prop(themeCss({ radius: -3 }), '--radius'), '0px');
  assert.equal(prop(themeCss({ radius: 'full' }), '--radius'), '999px');
});

test('переключатели: без иконок сайтов, со счётчиками папок, с линиями уровней', () => {
  assert.match(themeCss({ favicons: false }), /#list li img \{ display: none; \}/);
  assert.match(themeCss({ folderCounts: true }), /#list \.count \{ display: block; \}/);
  assert.match(themeCss({ indentGuides: true }), /#list \.guides \{ display: block; \}/);
});

test('свой CSS — последним и только при включённом переключателе', () => {
  const customCss = 'li { color: red }';
  assert.equal(themeCss({ customCss }), '');
  assert.equal(themeCss({ customCss, customCssOn: true }), 'li { color: red }\n');
  assert.match(themeCss({ customCss, customCssOn: true, mode: 'dark' }), /\}\nli \{ color: red \}\n$/);
});

test('cleanTheme: из хранилища (или файла) — полная тема в допустимых значениях', () => {
  assert.deepEqual(cleanTheme(undefined), THEME_DEFAULTS);
  assert.deepEqual(cleanTheme('junk'), THEME_DEFAULTS);
  const t = cleanTheme({
    mode: 'dark', colors: { dark: { accent: '#00ff00', text: 'blue' } }, font: 'Georgia; }',
    fontSize: 99, radius: 'full', favicons: 'no', folderCounts: true, customCss: 7, customCssOn: true,
  });
  assert.deepEqual(t, {
    ...THEME_DEFAULTS, mode: 'dark',
    colors: { light: { background: '', text: '', accent: '' }, dark: { background: '', text: '', accent: '#00ff00' } },
    font: 'Georgia', fontSize: 24, radius: 'full', folderCounts: true, customCss: '', customCssOn: true,
  });
  // незакрытая кавычка или комментарий проглотили бы остальные свойства темы
  assert.equal(cleanTheme({ font: '"Fira Code' }).font, 'Fira Code');
  assert.match(themeCss({ font: 'Arial /*', fontSize: 16 }), /--font-size: 16px/);
  assert.equal(cleanTheme({ fontSize: 'browser', radius: 2.4 }).fontSize, 'browser');
  assert.equal(cleanTheme({ radius: 2.4 }).radius, 2);
});

test('главная кнопка окон — акцент темы, текст на ней читаем: светлый на тёмном, тёмный на светлом', () => {
  const css = themeCss({ colors: { light: { accent: '#ffee00' }, dark: { accent: '#102030' } } });
  assert.equal(prop(css, '--primary'), 'light-dark(#ffee00, #102030)');
  assert.equal(prop(css, '--on-primary'), 'light-dark(#1d1f23, #fff)');
  // незаданный акцент темы — прежний (#7ea6ff светлый → тёмный текст)
  assert.equal(prop(themeCss({ colors: { light: { accent: '#000000' } } }), '--on-primary'), 'light-dark(#fff, #1d1f23)');
});

test('сообщения и подпись при перетаскивании — инверсия фона и текста; строка под курсором — от приглушённого', () => {
  const css = themeCss({ colors: { light: { background: '#ffffff', text: '#111111' } } });
  assert.equal(prop(css, '--tip-bg'), 'light-dark(#111111, #e8e9eb)');
  assert.equal(prop(css, '--tip-fg'), 'light-dark(#ffffff, #1d1f23)');
  assert.match(prop(css, '--muted-cur'), /var\(--muted\).*var\(--text\)/);
  assert.equal(prop(themeCss({ colors: { light: { accent: '#ff0000' } } }), '--tip-bg'), undefined);
});
