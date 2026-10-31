import './locale-ru.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMANDS, mirrorKey, keymapOf, bindingsOf, resolveKeymap, chordOf, physicalChordOf, splitChord,
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
