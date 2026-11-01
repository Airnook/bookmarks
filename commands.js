// Реестр команд панели, разбор сочетаний клавиш и умолчания настроек. Общий для панели, настроек и справки.
// ES-модуль: страницы импортируют отсюда то, что им нужно.
import { t } from './i18n.js';
//
// Сочетание — строка из аккордов через пробел: «Enter», «Mod+Enter», «Alt+ArrowUp»,
// «g g» (последовательность), «Enter Enter» (двойное нажатие). Mod — ⌘ на Mac и Ctrl
// на остальных; на Mac Ctrl — отдельный модификатор «Ctrl» (⌃). Буквы пишутся строчными;
// для печатных символов (?, /, ,) Shift входит в сам символ и отдельно не пишется.
//
// Тексты команд — в сообщениях (_locales): cmd_<id> — короткое название (палитра, настройки,
// справка), cmd_<id>_note — пояснение второй строкой (если есть), cmd_<id>_words — слова
// для поиска в палитре на языке интерфейса; английские слова (words ниже) ищутся всегда.
// В id точки заменяются на «_»: cmd_cursor_down. Группа — group_<group>.

// Значения настроек, пока пользователь ничего не менял. Панель и страница настроек читают их отсюда.
export const SETTINGS_DEFAULTS = { rootId: '', autoHide: false, pinnedTabs: true, newTab: false, view: 'normal' };

const DEFINITIONS = [
  // навигация
  { id: 'search', group: 'nav', keys: ['/', 'Mod+f'], words: 'search find filter' },
  { id: 'cursor.down', group: 'nav', keys: ['ArrowDown'], repeat: true, words: 'down next' },
  { id: 'cursor.up', group: 'nav', keys: ['ArrowUp'], repeat: true, words: 'up previous' },
  { id: 'cursor.first', group: 'nav', keys: ['Home'], words: 'top first home' },
  { id: 'cursor.last', group: 'nav', keys: ['End'], words: 'bottom last end' },
  { id: 'folder.expand', group: 'nav', keys: ['ArrowRight'], words: 'expand open folder' },
  { id: 'folder.collapse', group: 'nav', keys: ['ArrowLeft'], words: 'collapse parent' },
  { id: 'folders.collapseAll', group: 'nav', keys: [], words: 'collapse all' },

  // открытие
  { id: 'open', group: 'open', keys: ['Enter'], words: 'open go' },
  { id: 'open.alt', group: 'open', keys: ['Mod+Enter'], words: 'open alternate' },
  { id: 'open.newTab', group: 'open', keys: [], words: 'new tab' },
  { id: 'open.currentTab', group: 'open', keys: [], words: 'current tab here' },
  { id: 'open.group', group: 'open', keys: [], words: 'tab group' },
  { id: 'open.reset', group: 'open', keys: ['Shift+Enter'], words: 'reset pinned url' },

  // отметки
  { id: 'mark.toggle', group: 'marks', keys: ['Space'], words: 'mark select' },
  { id: 'mark.down', group: 'marks', keys: ['Shift+ArrowDown'], repeat: true, words: 'mark down select' },
  { id: 'mark.up', group: 'marks', keys: ['Shift+ArrowUp'], repeat: true, words: 'mark up select' },
  { id: 'mark.all', group: 'marks', keys: ['Mod+a'], words: 'select all' },
  { id: 'mark.clear', group: 'marks', keys: [], words: 'clear deselect' },

  // правка
  { id: 'folder.new', group: 'edit', keys: ['n'], words: 'new folder create' },
  { id: 'rename', group: 'edit', keys: ['r', 'F2'], words: 'rename title edit' },
  { id: 'edit', group: 'edit', keys: [], words: 'edit title address url' },
  { id: 'move.to', group: 'edit', keys: ['m'], words: 'move to folder' },
  { id: 'url.update', group: 'edit', keys: ['u'], words: 'update url replace address' },
  { id: 'delete', group: 'edit', keys: ['d'], words: 'delete remove' },
  { id: 'copy.url', group: 'edit', keys: ['c'], words: 'copy url link' },
  { id: 'cut', group: 'edit', keys: ['Mod+x'], words: 'cut move clipboard' },
  { id: 'copy', group: 'edit', keys: ['Mod+c'], words: 'copy duplicate clipboard' },
  { id: 'paste', group: 'edit', keys: ['Mod+v'], words: 'paste insert clipboard' },
  { id: 'tab.close', group: 'edit', keys: ['Backspace', 'Delete'], words: 'close tab' },
  { id: 'move.up', group: 'edit', keys: ['Alt+ArrowUp'], repeat: true, words: 'move up' },
  { id: 'move.down', group: 'edit', keys: ['Alt+ArrowDown'], repeat: true, words: 'move down' },
  { id: 'undo', group: 'edit', keys: ['Mod+z'], words: 'undo revert back restore' },
  { id: 'redo', group: 'edit', keys: ['Mod+Shift+z', 'Mod+y'], words: 'redo again repeat' },

  // панель
  { id: 'palette', group: 'panel', keys: ['Mod+k', '?'], words: 'command palette help' },
  { id: 'menu', group: 'panel', keys: ['Shift+F10', 'ContextMenu'], words: 'context menu right click' },
  { id: 'view.cycle', group: 'panel', keys: ['v'], words: 'view mode address compact' },
  { id: 'help', group: 'panel', keys: ['i', 'F1'], words: 'help info docs manual' },
  { id: 'settings', group: 'panel', keys: [','], words: 'settings options preferences' },
  { id: 'escape', group: 'panel', keys: ['Escape'], words: 'escape cancel close' },
  { id: 'panel.close', group: 'panel', keys: [], words: 'close panel hide' },
];

const commandText = (c) => {
  const key = 'cmd_' + c.id.replaceAll('.', '_');
  const note = t(key + '_note');
  return { ...c, title: t(key), ...(note && { note }), words: `${t(key + '_words')} ${c.words}`.trim() };
};
export const COMMANDS = DEFINITIONS.map(commandText);
export const groupTitle = (group) => t('group_' + group);

export const COMMAND = Object.fromEntries(COMMANDS.map(c => [c.id, c]));

// Наборы сочетаний: только отличия от клавиш DEFINITIONS (это arc-legacy — клавиши до 2.7).
// Хранимые настройки клавиш — тоже отличия от DEFINITIONS, поэтому старые сохраняют смысл.
export const PRESETS = {
  // привычные Chrome и Finder; Mod+y нет: ⌘Y на Mac — история Chrome
  default: {
    'folder.new': ['Mod+Alt+n'],
    'rename': ['F2'],
    'edit': ['Mod+i'],
    'move.to': [],
    'url.update': [],
    'delete': ['Mod+Backspace', 'Delete'],
    'copy.url': ['Mod+Shift+c'],
    'tab.close': [],
    'redo': ['Mod+Shift+z'],
    'palette': ['Mod+k'],
    'view.cycle': [],
    'help': ['F1', 'Mod+/'],
    'settings': ['Mod+,'],
  },
  // arc-legacy плюс клавиши Arc, которые Chrome отдаёт странице (⌘T и ⌘W он забирает себе)
  arc: {
    'cursor.down': ['ArrowDown', 'Mod+Alt+ArrowDown'],
    'cursor.up': ['ArrowUp', 'Mod+Alt+ArrowUp'],
    'delete': ['d', 'Mod+Backspace'],
    'copy.url': ['c', 'Mod+Shift+c'],
    'palette': ['Mod+k', '?', 'Mod+l'],
    'settings': [',', 'Mod+,'],
    'panel.close': ['Mod+s'],
  },
  'arc-legacy': {},
  vim: {
    'cursor.down': ['ArrowDown', 'j'],
    'cursor.up': ['ArrowUp', 'k'],
    'folder.expand': ['ArrowRight', 'l'],
    'folder.collapse': ['ArrowLeft', 'h'],
    'cursor.first': ['Home', 'g g'],
    'cursor.last': ['End', 'Shift+g'],
    'mark.down': ['Shift+ArrowDown', 'Shift+j'],
    'mark.up': ['Shift+ArrowUp', 'Shift+k'],
    'move.down': ['Alt+ArrowDown', 'Alt+j'],
    'move.up': ['Alt+ArrowUp', 'Alt+k'],
    'open': ['Enter', 'o'],
    'open.alt': ['Mod+Enter', 'Shift+o'],
    'delete': ['d d'],
    'copy.url': ['y y'],
    'tab.close': ['Backspace', 'Delete', 'x'],
    'palette': ['Mod+k', '?', ':'],
  },
};

// Сочетания, которые Chrome или система забирают раньше страницы: панель их не услышит.
// Их нельзя записать, и их нет ни в одном наборе.
const RESERVED_ANY = ['Mod+t', 'Mod+w', 'Mod+n', 'Mod+Shift+n', 'Mod+Shift+t', 'Mod+Shift+w', 'Mod+Tab', 'Mod+Shift+Tab'];
const RESERVED = {
  mac: new Set([...RESERVED_ANY, 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Mod+h', 'Mod+Alt+h', 'Mod+m', 'Mod+q',
    'Mod+Space', 'Mod+Alt+Space', 'Mod+Alt+Escape', 'Mod+Alt+ArrowLeft', 'Mod+Alt+ArrowRight',
    'Ctrl+ArrowUp', 'Ctrl+ArrowDown', 'Ctrl+ArrowLeft', 'Ctrl+ArrowRight']),
  pc: new Set([...RESERVED_ANY, 'Mod+PageUp', 'Mod+PageDown', 'Mod+F4', 'Alt+F4', 'F11']),
};
export const isReserved = (binding, mac = IS_MAC) => binding.split(' ').some(chord => RESERVED[mac ? 'mac' : 'pc'].has(chord));

// Настройки клавиш из хранилища: если там не объект — считаем, что ничего не меняли
export const keymapOf = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

// keymap из хранилища: нет его — новая установка, набор default
// (обновлённым со старых версий фон записывает keymap сам)
export const storedKeymap = (value) => (value == null ? structuredClone(PRESETS.default) : keymapOf(value));

// Клавиши из файла: оставляем известные команды и годные сочетания, считаем отброшенное.
// Итог: { preset, keymap, dropped }; не объект keymap — null.
export function cleanHotkeys({ preset, keymap } = {}) {
  if (!keymap || typeof keymap !== 'object' || Array.isArray(keymap)) return null;
  let dropped = 0;
  const clean = {};
  for (const [id, list] of Object.entries(keymap)) {
    if (!Object.hasOwn(COMMAND, id) || !Array.isArray(list)) { dropped++; continue; }
    const keys = bindingsOf(id, { [id]: list }).filter(b => !isReserved(b));
    dropped += list.length - keys.length;
    if (keys.length || !list.length) clean[id] = keys; // всё негодное — оставляем умолчание, а не «без клавиш»
  }
  const known = Object.hasOwn(PRESETS, preset);
  const custom = preset === 'custom'; // свои сочетания вне наборов: не ошибка, набор для «Сбросить» — умолчание
  return { preset: known ? preset : 'default', keymap: clean, dropped: dropped + (known || custom ? 0 : 1) };
}

// Сочетания команды с учётом пользовательских изменений. Испорченная запись
// в настройках (не массив, не строки, лишние пробелы, повторы) не ломает панель.
export function bindingsOf(id, keymap) {
  const custom = keymapOf(keymap)[id];
  if (!Array.isArray(custom)) return COMMAND[id].keys;
  const clean = custom.filter(b => typeof b === 'string').map(b => b.trim().split(/\s+/).join(' ')).filter(Boolean);
  return [...new Set(clean)];
}

// Итоговые сочетания всех команд: id → список. Одно сочетание — у одной команды,
// и назначенное вами важнее умолчания: новая команда с «/» по умолчанию
// не отберёт «/», который вы раньше отдали другой команде.
export function resolveKeymap(keymap) {
  const km = keymapOf(keymap);
  const custom = (c) => Array.isArray(km[c.id]);
  const out = new Map(COMMANDS.map(c => [c.id, []]));
  const taken = new Set();
  for (const c of [...COMMANDS.filter(custom), ...COMMANDS.filter(c => !custom(c))]) {
    for (const b of bindingsOf(c.id, km)) {
      if (!taken.has(b)) { taken.add(b); out.get(c.id).push(b); }
    }
  }
  return out;
}

// Ожидание продолжения сочетания: второе нажатие той же клавиши (двойное нажатие)
// ждём недолго, чтобы одиночное не тормозило; другую клавишу последовательности — дольше.
export const DOUBLE_WAIT = 350;
export const SEQUENCE_WAIT = 1000;

// Платформа: Mac или нет. Функции, которые от неё зависят, принимают её последним
// параметром (по умолчанию — текущая), чтобы тесты проверяли обе без перезагрузки модуля.
export const isMacPlatform = (platform) => /mac|iphone|ipad/i.test(platform);
export const IS_MAC = isMacPlatform(navigator.userAgentData?.platform ?? navigator.platform);

// Страница справа налево? В RTL ← и → в списках меняются местами (WAI-ARIA Tree View):
// сочетания хранятся логически («ArrowRight» — раскрыть), а нажатая и показанная стрелка зеркалится.
export const isRtl = () => globalThis.document?.documentElement.dir === 'rtl';
const MIRROR = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };
export const mirrorKey = (key, rtl = isRtl()) => (rtl && MIRROR[key]) || key;

export const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'FnLock', 'OS', 'AltGraph']);
const SYMBOL_CODES = {
  Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", Backquote: '`',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=',
};
// Те же клавиши с Shift — как на английской раскладке: русская Shift+Ж — это «:»
const SHIFTED_CODES = {
  Slash: '?', Period: '>', Comma: '<', Semicolon: ':', Quote: '"', Backquote: '~',
  BracketLeft: '{', BracketRight: '}', Backslash: '|', Minus: '_', Equal: '+',
  Digit1: '!', Digit2: '@', Digit3: '#', Digit4: '$', Digit5: '%',
  Digit6: '^', Digit7: '&', Digit8: '*', Digit9: '(', Digit0: ')',
};

// Клавиша нажатия: [название, по физической клавише ли]. Латиница — по символу
// (учитывает Dvorak и т.п.); другие раскладки, Option на Mac (печатает «∆», «®»)
// и мёртвые клавиши — по физической клавише.
function keyOf(e) {
  const k = e.key;
  if (MODIFIER_KEYS.has(k)) return null;
  if (k === ' ' || e.code === 'Space') return ['Space', false];
  if (k.length !== 1 && k !== 'Dead' && k !== 'Unidentified') return [k, false]; // Enter, ArrowUp, F2…
  const latin = /^[\x21-\x7e]$/.test(k);
  if (latin && (!e.altKey || altGraph(e))) return [k.toLowerCase(), false];
  if (e.code.startsWith('Key')) return [e.code.slice(3).toLowerCase(), true];
  if (e.shiftKey && SHIFTED_CODES[e.code]) return [SHIFTED_CODES[e.code], false]; // символ — Shift уже в нём
  if (e.code.startsWith('Digit')) return [e.code.slice(5), true];
  if (SYMBOL_CODES[e.code]) return [SYMBOL_CODES[e.code], true];
  return latin ? [k, false] : null;
}

// AltGr на Windows приходит как Ctrl+Alt
const altGraph = (e) => !!e.getModifierState?.('AltGraph');

// Аккорд нажатия: «Mod+Alt+Shift+клавиша»; null — нажали только модификатор
export function chordOf(e, mac = IS_MAC, rtl = isRtl()) {
  const found = keyOf(e);
  if (!found) return null;
  const [rawKey, physical] = found;
  const key = mirrorKey(rawKey, rtl);
  const altGr = altGraph(e);
  // AltGr, напечатавший символ (немецкая AltGr+Q → «@»), — это ввод, а не модификатор;
  // с остальными клавишами (стрелки, Enter, буквы по физической клавише) он — Alt
  const typed = altGr && key.length === 1 && !physical;
  // у напечатанного символа (?, !, @) Shift уже внутри него; у физической клавиши — нет
  const symbol = key.length === 1 && !/[a-z]/.test(key) && !physical;
  const mods = modsOf(e, altGr, mac);
  if ((e.altKey || altGr) && !typed) mods.push('Alt');
  if (e.shiftKey && !symbol) mods.push('Shift');
  return [...mods, key].join('+');
}

// ⌘ на Mac (Ctrl там — отдельный модификатор: в полях ввода это команды правки текста),
// Ctrl на остальных. Ctrl при AltGr — не настоящий.
function modsOf(e, altGr, mac) {
  if (mac) return [...(e.metaKey ? ['Mod'] : []), ...(e.ctrlKey ? ['Ctrl'] : [])];
  return e.metaKey || (e.ctrlKey && !altGr) ? ['Mod'] : [];
}

// Тот же аккорд по месту клавиши на английской раскладке — для знаков и цифр.
// На русской раскладке клавиша «/» печатает точку, а Shift+«/» — запятую;
// если напечатанное ничего не значит, панель пробует этот вариант. null — вариант тот же.
export function physicalChordOf(e, mac = IS_MAC) {
  const code = e.code ?? '';
  const plain = SYMBOL_CODES[code] ?? (code.startsWith('Digit') ? code.slice(5) : null);
  if (!plain || /^[a-z]$/i.test(e.key)) return null; // буква на месте знака (Dvorak) — это буква
  const shifted = e.shiftKey ? SHIFTED_CODES[code] : null; // Shift уже внутри символа
  const altGr = altGraph(e);
  const mods = modsOf(e, altGr, mac);
  if (e.altKey || altGr) mods.push('Alt');
  const chord = [...mods, shifted || plain].join('+');
  return chord === chordOf(e, mac) ? null : chord;
}

// Раскладка нелатинская? Узнаём по последней нажатой букве (на месте R напечатано «к»).
// Браузерный Keyboard API тут не помогает: он всегда отвечает латинской раскладкой.
let latinLayout = null; // null — букв ещё не было
globalThis.document?.addEventListener('keydown', (e) => {
  if (/^Key[A-Z]$/.test(e.code) && /^\p{L}$/u.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
    latinLayout = /^\p{Script=Latin}$/u.test(e.key);
  }
}, true);

// Знаки на нелатинской раскладке понимаем по месту клавиши, как и буквы: русская
// Shift+«/» — это «?», а не «,». Русскую ПК-раскладку узнаём и без букв: только на ней
// клавиша «/» печатает точку или запятую.
export const preferPhysical = (e) => latinLayout === false || (e.code === 'Slash' && (e.key === '.' || e.key === ','));

// Аккорд → [модификаторы, клавиша]; клавиша сама может быть «+»
export function splitChord(chord) {
  const m = chord.match(/^((?:(?:Mod|Ctrl|Alt|Shift)\+)*)(.+)$/);
  return m ? [m[1].split('+').filter(Boolean), m[2]] : [[], chord];
}

// Для показа: «⌘ K», «⇧ ↓», «G G»
export const keyLabels = (mac = IS_MAC, rtl = isRtl()) => ({
  ArrowUp: '↑', ArrowDown: '↓', [mirrorKey('ArrowLeft', rtl)]: '←', [mirrorKey('ArrowRight', rtl)]: '→',
  Enter: 'Enter', Space: t('key_space'), Escape: 'Esc', Backspace: '⌫', Delete: mac ? '⌦' : 'Delete', ContextMenu: 'Menu',
});
export const modLabels = (mac = IS_MAC) => (mac ? { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' } : { Mod: 'Ctrl', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift' });
export const MOD_LABELS = modLabels();

export function formatChord(chord, mac = IS_MAC, rtl = isRtl()) {
  const [mods, key] = splitChord(chord);
  const modNames = modLabels(mac);
  return [...mods.map(m => modNames[m]), keyLabels(mac, rtl)[key] ?? (key.length === 1 ? key.toUpperCase() : key)];
}
// [[«⌘», «K»]] — аккорды по отдельности, чтобы рисовать каждую клавишу
export const formatBinding = (binding, mac = IS_MAC, rtl = isRtl()) => binding.split(' ').map(chord => formatChord(chord, mac, rtl));

// Сочетание текстом: «Ctrl+K», «⌘K», «G G»
export const shortcutText = (binding, mac = IS_MAC) => formatBinding(binding, mac).map(chord => chord.join(mac ? '' : '+')).join(' ');

// Сочетание клавишами <kbd>; между аккордами последовательности — небольшой зазор
export function bindingNodes(binding) {
  const out = [];
  formatBinding(binding).forEach((chord, i) => {
    if (i) out.push(Object.assign(document.createElement('span'), { className: 'then' }));
    for (const label of chord) out.push(Object.assign(document.createElement('kbd'), { textContent: label }));
  });
  return out;
}
