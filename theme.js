// Тема панели: настройки внешнего вида (ключ `theme` в chrome.storage.local) → CSS для <style id="theme">.
// Общий для панели и настроек. Умолчания — то, что уже нарисовано в base.css и panel.html:
// для них CSS пуст, и вид панели не меняется.
export const THEME_DEFAULTS = {
  mode: 'system', // system | light | dark
  colors: { light: { background: '', text: '', accent: '' }, dark: { background: '', text: '', accent: '' } }, // '' — как было
  font: '',       // '' — системный
  fontSize: 13,   // px или 'browser'
  radius: 7,      // px или 'full'
  favicons: true,
  folderCounts: false,
  indentGuides: false,
  customCss: '',
  customCssOn: false,
};

// Сегодняшние значения (base.css, panel.html): незаданный цвет темы берётся отсюда
export const THEME_BASE = {
  light: { background: 'Canvas', text: '#1d1f23', accent: '#2563eb', muted: '#6c717a', surface: '#fff' },
  dark: { background: 'Canvas', text: '#e8e9eb', accent: '#7ea6ff', muted: '#9aa0a9', surface: '#232428' },
};
const MODES = ['light', 'dark'];
export const FONT_SIZE = { min: 10, max: 24 };
export const RADIUS = { min: 0, max: 16 };
const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'; // как в base.css
// число в границах; не число — умолчание
const clamp = (v, { min, max }, fallback) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : '');
// галочка отметки — картинка, цвет зашит в неё (как в panel.html)
const check = (color) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M2 5.2 4 7.2 8 3' fill='none' stroke='%23${color.slice(1)}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

const COLORS = ['background', 'text', 'accent'];
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

// Тема из хранилища или файла → полная тема в допустимых значениях: чужое и негодное — умолчание,
// числа — в границах, из названия шрифта убраны символы, которые вывели бы его за пределы значения
export function cleanTheme(stored) {
  const t = stored && typeof stored === 'object' ? stored : {};
  const d = THEME_DEFAULTS;
  return {
    mode: ['system', ...MODES].includes(t.mode) ? t.mode : d.mode,
    colors: Object.fromEntries(MODES.map(m => [m, Object.fromEntries(COLORS.map(k => [k, hex(t.colors?.[m]?.[k])]))])),
    font: typeof t.font === 'string' ? t.font.replace(/[;{}<>\\]/g, ' ').trim() : d.font,
    fontSize: t.fontSize === 'browser' ? 'browser' : clamp(t.fontSize, FONT_SIZE, d.fontSize),
    radius: t.radius === 'full' ? 'full' : clamp(t.radius, RADIUS, d.radius),
    favicons: bool(t.favicons, d.favicons),
    folderCounts: bool(t.folderCounts, d.folderCounts),
    indentGuides: bool(t.indentGuides, d.indentGuides),
    customCss: typeof t.customCss === 'string' ? t.customCss : d.customCss,
    customCssOn: bool(t.customCssOn, d.customCssOn),
  };
}

export function themeCss(stored) {
  const theme = cleanTheme(stored);
  const { mode, colors: own } = theme;
  const color = (m, k) => own[m][k] || THEME_BASE[m][k];
  const vars = [];
  const pair = (name, fn) => vars.push(`${name}: light-dark(${fn('light')}, ${fn('dark')})`);
  const changed = (k) => own.light[k] || own.dark[k];

  if (mode !== 'system') vars.push(`color-scheme: ${mode}`);
  if (changed('background')) {
    pair('--bg', m => color(m, 'background'));
    // окна поверх панели — чуть отличаются от своего фона, как сейчас
    pair('--surface', m => (own[m].background ? `color-mix(in srgb, ${own[m].background} 94%, ${color(m, 'text')})` : THEME_BASE[m].surface));
  }
  if (changed('text')) {
    pair('--text', m => color(m, 'text'));
    pair('--muted', m => (own[m].text ? `color-mix(in srgb, ${own[m].text} 62%, transparent)` : THEME_BASE[m].muted));
  }
  if (changed('accent')) pair('--accent', m => color(m, 'accent'));

  if (theme.font) vars.push(`--font: ${theme.font}, ${SYSTEM_FONT}`);
  if (theme.fontSize !== THEME_DEFAULTS.fontSize) vars.push(`--font-size: ${theme.fontSize === 'browser' ? 'medium' : theme.fontSize + 'px'}`);
  if (theme.radius !== THEME_DEFAULTS.radius) vars.push(`--radius: ${theme.radius === 'full' ? 999 : theme.radius}px`);

  let media = '';
  if (changed('accent') || mode !== 'system') {
    vars.push(`--check: ${check(color(mode === 'dark' ? 'dark' : 'light', 'accent'))}`);
    if (mode === 'system') media = `@media (prefers-color-scheme: dark) { :root { --check: ${check(color('dark', 'accent'))}; } }\n`;
  }

  // счётчики и линии уровней панель рисует всегда, скрытыми (panel.html)
  const rules = [
    !theme.favicons && '#list li img { display: none; }',
    theme.folderCounts && '#list .count { display: block; } #list li:has(> .count)::after { margin-inline-start: 0; }', // точка вкладки — после числа
    theme.indentGuides && '#list .guides { display: block; } #list li:has(> .guides) { position: relative; }',
    theme.customCssOn && theme.customCss, // свой CSS — последним: перекрывает всё
  ].filter(Boolean).map(r => r + '\n').join('');

  return (vars.length ? `:root { ${vars.join('; ')}; }\n` : '') + media + rules;
}
