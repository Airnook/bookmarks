import './locale-ru.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMANDS, PRESETS, isReserved, mirrorKey, keymapOf, bindingsOf, resolveKeymap, chordOf, physicalChordOf, splitChord,
  formatChord, shortcutText, isMacPlatform, modLabels, keyLabels,
} from '../commands.js';

// Платформа — параметром: false — Linux/Windows, true — Mac
const MAC = true;
const PC = false;

// Событие клавиатуры с разумными умолчаниями
const ev = (o) => ({ key: '', code: '', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...o });

test('keymapOf: только объект считается настройками', () => {
  assert.deepEqual(keymapOf({ a: 1 }), { a: 1 });
  for (const bad of [null, undefined, 'x', 5, [1]]) assert.deepEqual(keymapOf(bad), {});
});

test('bindingsOf: умолчание, замена, чистка мусора', () => {
  assert.deepEqual(bindingsOf('open', undefined), ['Enter']);
  assert.deepEqual(bindingsOf('open', { open: ['  g   g ', 'g g', '', 5, 'x'] }), ['g g', 'x']);
  assert.deepEqual(bindingsOf('open', { open: [] }), []);
  assert.deepEqual(bindingsOf('open', { open: 'x' }), ['Enter']); // не массив — умолчание
});

test('resolveKeymap: одно сочетание — одной команде, пользовательское важнее', () => {
  const def = resolveKeymap({});
  assert.deepEqual(def.get('search'), ['/', 'Mod+f']);
  assert.equal(def.size, COMMANDS.length);
  // «/» отдан другой команде — у «search» его нет, у владельца есть
  const r = resolveKeymap({ delete: ['/'] });
  assert.deepEqual(r.get('delete'), ['/']);
  assert.deepEqual(r.get('search'), ['Mod+f']);
  // конфликт между пользовательскими — достаётся первой по порядку команд
  const dup = resolveKeymap({ search: ['q'], delete: ['q'] });
  assert.deepEqual(dup.get('search'), ['q']);
  assert.deepEqual(dup.get('delete'), []);
});

test('chordOf: модификаторы и клавиши', () => {
  const chord = (e) => chordOf(e, PC);
  assert.equal(chord(ev({ key: 'Enter', code: 'Enter' })), 'Enter');
  assert.equal(chord(ev({ key: 'k', code: 'KeyK', ctrlKey: true })), 'Mod+k');
  assert.equal(chord(ev({ key: 'K', code: 'KeyK', shiftKey: true })), 'Shift+k');
  assert.equal(chord(ev({ key: 'ArrowUp', code: 'ArrowUp', altKey: true, shiftKey: true })), 'Alt+Shift+ArrowUp');
  assert.equal(chord(ev({ key: ' ', code: 'Space' })), 'Space');
  assert.equal(chord(ev({ key: '?', code: 'Slash', shiftKey: true })), '?'); // Shift внутри символа
  assert.equal(chord(ev({ key: 'Shift', code: 'ShiftLeft', shiftKey: true })), null);
  // русская раскладка: буква по физической клавише
  assert.equal(chord(ev({ key: 'к', code: 'KeyR' })), 'r');
});

test('chordOf: Mac различает ⌘ и Ctrl, AltGr — не Ctrl', () => {
  assert.equal(chordOf(ev({ key: 'k', code: 'KeyK', metaKey: true }), MAC), 'Mod+k');
  assert.equal(chordOf(ev({ key: 'k', code: 'KeyK', ctrlKey: true }), MAC), 'Ctrl+k');
  // не на Mac ⌘ (Win) — тоже Mod, а Ctrl отдельно не бывает
  assert.equal(chordOf(ev({ key: 'k', code: 'KeyK', metaKey: true }), PC), 'Mod+k');
  const altGr = ev({ key: '@', code: 'KeyQ', ctrlKey: true, altKey: true, getModifierState: (m) => m === 'AltGraph' });
  assert.equal(chordOf(altGr, PC), '@'); // напечатанный символ — ввод
});

test('physicalChordOf: знак по месту клавиши, null если совпадает', () => {
  const physical = (e) => physicalChordOf(e, PC);
  assert.equal(physical(ev({ key: '.', code: 'Slash' })), '/'); // русская «/» печатает «.»
  assert.equal(physical(ev({ key: ',', code: 'Slash', shiftKey: true })), '?');
  assert.equal(physical(ev({ key: '/', code: 'Slash' })), null);
  assert.equal(physical(ev({ key: 'a', code: 'KeyA' })), null);
  assert.equal(physical(ev({ key: 'x', code: 'Slash' })), null); // буква на месте знака
});

test('physicalChordOf: модификаторы — по платформе', () => {
  assert.equal(physicalChordOf(ev({ key: '.', code: 'Slash', ctrlKey: true }), PC), 'Mod+/');
  assert.equal(physicalChordOf(ev({ key: '.', code: 'Slash', ctrlKey: true }), MAC), 'Ctrl+/');
  assert.equal(physicalChordOf(ev({ key: '.', code: 'Slash', metaKey: true }), MAC), 'Mod+/');
});

test('splitChord', () => {
  assert.deepEqual(splitChord('Mod+Alt+k'), [['Mod', 'Alt'], 'k']);
  assert.deepEqual(splitChord('Enter')[0], []);
  assert.equal(splitChord('Mod++')[1], '+'); // клавиша «+»
  assert.equal(splitChord('Shift+g')[1], 'g');
});

test('formatChord / shortcutText: Linux и Mac', () => {
  assert.deepEqual(formatChord('Mod+ArrowDown', PC), ['Ctrl', '↓']);
  assert.equal(shortcutText('Mod+k', PC), 'Ctrl+K');
  assert.equal(shortcutText('g g', PC), 'G G');
  assert.equal(shortcutText('Shift+Enter', PC), 'Shift+Enter');
  assert.deepEqual(formatChord('Mod+Shift+Delete', PC), ['Ctrl', 'Shift', 'Delete']);
  assert.deepEqual(formatChord('Mod+Shift+Delete', MAC), ['⌘', '⇧', '⌦']);
  assert.equal(shortcutText('Mod+k', MAC), '⌘K');
  assert.equal(shortcutText('Ctrl+Alt+g g', MAC), '⌃⌥G G');
  assert.equal(shortcutText('Space', MAC), 'Пробел');
});

test('платформа: распознавание и подписи клавиш', () => {
  for (const p of ['MacIntel', 'macOS', 'iPhone', 'iPad']) assert.equal(isMacPlatform(p), true, p);
  for (const p of ['Linux x86_64', 'Win32', 'Windows', 'Android', '']) assert.equal(isMacPlatform(p), false, p);
  assert.equal(modLabels(MAC).Mod, '⌘');
  assert.equal(modLabels(PC).Mod, 'Ctrl');
  assert.equal(keyLabels(MAC).Delete, '⌦');
  assert.equal(keyLabels(PC).Delete, 'Delete');
});

test('реестр команд: уникальные id и сочетания по умолчанию без конфликтов', () => {
  const ids = COMMANDS.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const all = COMMANDS.flatMap(c => c.keys);
  assert.equal(new Set(all).size, all.length);
});

test('RTL: ← и → меняются местами при разборе нажатия и при показе', () => {
  const press = (key, rtl) => chordOf(ev({ key, code: key }), PC, rtl);
  assert.equal(press('ArrowRight', false), 'ArrowRight');
  assert.equal(press('ArrowLeft', false), 'ArrowLeft');
  assert.equal(press('ArrowRight', true), 'ArrowLeft');
  assert.equal(press('ArrowLeft', true), 'ArrowRight');
  assert.equal(chordOf(ev({ key: 'ArrowLeft', code: 'ArrowLeft', altKey: true }), PC, true), 'Alt+ArrowRight');
  assert.equal(formatChord('ArrowRight', PC, false)[0], '→');
  assert.equal(formatChord('ArrowRight', PC, true)[0], '←'); // «раскрыть» показано той клавишей, что её раскрывает
  assert.equal(formatChord('ArrowLeft', PC, true)[0], '→');
  for (const rtl of [false, true]) {
    for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End']) assert.equal(press(key, rtl), key);
    assert.equal(formatChord('Alt+ArrowUp', PC, rtl)[1], '↑');
    assert.equal(mirrorKey('Home', rtl), 'Home');
  }
  // нажатое и показанное совпадают: нажатие, запускающее ArrowRight, показано как та же стрелка
  assert.equal(formatChord(press('ArrowLeft', true), PC, true)[0], '←');
});

// Клавиши 2.6.0 (набор «Стандартный») — дословно: пользователи, закреплённые на arc-legacy, не замечают обновления
const KEYS_2_6_0 = {
  'search': ['/', 'Mod+f'],
  'cursor.down': ['ArrowDown'],
  'cursor.up': ['ArrowUp'],
  'cursor.first': ['Home'],
  'cursor.last': ['End'],
  'folder.expand': ['ArrowRight'],
  'folder.collapse': ['ArrowLeft'],
  'folders.collapseAll': [],
  'open': ['Enter'],
  'open.alt': ['Mod+Enter'],
  'open.newTab': [],
  'open.currentTab': [],
  'open.group': [],
  'open.reset': ['Shift+Enter'],
  'mark.toggle': ['Space'],
  'mark.down': ['Shift+ArrowDown'],
  'mark.up': ['Shift+ArrowUp'],
  'mark.all': ['Mod+a'],
  'mark.clear': [],
  'folder.new': ['n'],
  'rename': ['r', 'F2'],
  'edit': [],
  'move.to': ['m'],
  'url.update': ['u'],
  'delete': ['d'],
  'copy.url': ['c'],
  'cut': ['Mod+x'],
  'copy': ['Mod+c'],
  'paste': ['Mod+v'],
  'tab.close': ['Backspace', 'Delete'],
  'move.up': ['Alt+ArrowUp'],
  'move.down': ['Alt+ArrowDown'],
  'undo': ['Mod+z'],
  'redo': ['Mod+Shift+z', 'Mod+y'],
  'palette': ['Mod+k', '?'],
  'menu': ['Shift+F10', 'ContextMenu'],
  'view.cycle': ['v'],
  'help': ['i', 'F1'],
  'settings': [','],
  'escape': ['Escape'],
  'panel.close': [],
};

test('наборы: arc-legacy — в точности клавиши 2.6.0', () => {
  assert.ok(Object.hasOwn(PRESETS, 'arc-legacy'));
  assert.deepEqual(Object.fromEntries(resolveKeymap(PRESETS['arc-legacy'])), KEYS_2_6_0);
});

// Таблицы из спецификации (#3, «Presets»); порядок внутри команды не важен
const sorted = (map) => Object.fromEntries([...map].map(([id, keys]) => [id, [...keys].sort()]));

test('наборы: default — таблица спецификации', () => {
  const changed = {
    'folder.new': ['Mod+Alt+n'],
    'rename': ['F2'],
    'edit': ['Mod+i'],
    'delete': ['Mod+Backspace', 'Delete'],
    'copy.url': ['Mod+Shift+c'],
    'redo': ['Mod+Shift+z'],
    'palette': ['Mod+k'],
    'help': ['F1', 'Mod+/'],
    'settings': ['Mod+,'],
    'move.to': [], 'url.update': [], 'tab.close': [], 'view.cycle': [], 'panel.close': [],
  };
  assert.deepEqual(sorted(resolveKeymap(PRESETS.default)), sorted(Object.entries({ ...KEYS_2_6_0, ...changed })));
});

test('наборы: arc — arc-legacy плюс клавиши Arc', () => {
  const added = {
    'copy.url': ['c', 'Mod+Shift+c'],
    'palette': ['Mod+k', '?', 'Mod+l'],
    'delete': ['d', 'Mod+Backspace'],
    'cursor.up': ['ArrowUp', 'Mod+Alt+ArrowUp'],
    'cursor.down': ['ArrowDown', 'Mod+Alt+ArrowDown'],
    'settings': [',', 'Mod+,'],
    'panel.close': ['Mod+s'],
  };
  assert.deepEqual(sorted(resolveKeymap(PRESETS.arc)), sorted(Object.entries({ ...KEYS_2_6_0, ...added })));
});

test('наборы: внутри каждого набора сочетания не конфликтуют', () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    const own = COMMANDS.flatMap(c => preset[c.id] ?? c.keys);
    assert.equal(new Set(own).size, own.length, name);
  }
});

test('isReserved: сочетания, которые Chrome или система забирают до страницы', () => {
  for (const mac of [MAC, PC]) {
    for (const b of ['Mod+t', 'Mod+w', 'Mod+n', 'Mod+Shift+n', 'Mod+Shift+t', 'Mod+Shift+w', 'g Mod+t']) {
      assert.equal(isReserved(b, mac), true, `${b} ${mac}`);
    }
    for (const b of ['Mod+k', 'Mod+Shift+c', 'Mod+Alt+ArrowUp', 'd d', 'Mod+s']) assert.equal(isReserved(b, mac), false, `${b} ${mac}`);
  }
  // Ctrl+Tab: на Mac Ctrl отдельный, на остальных это Mod
  assert.equal(isReserved('Ctrl+Tab', MAC), true);
  assert.equal(isReserved('Mod+Tab', PC), true);
  for (const b of ['Mod+h', 'Mod+m', 'Mod+q', 'Mod+Space', 'Ctrl+ArrowUp', 'Ctrl+ArrowLeft']) assert.equal(isReserved(b, MAC), true, b);
  assert.equal(isReserved('Mod+h', PC), false); // Ctrl+H — история, странице доступна
});

test('наборы: ни один не использует зарезервированное сочетание ни на одной платформе', () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    for (const [id, keys] of resolveKeymap(preset)) {
      for (const b of keys) for (const mac of [MAC, PC]) assert.equal(isReserved(b, mac), false, `${name}: ${id} ${b}`);
    }
  }
});
