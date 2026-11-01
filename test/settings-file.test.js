import './locale-ru.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { APP, envelope, readSettingsFile } from '../settings-file.js';
import { cleanHotkeys, PRESETS } from '../commands.js';

const file = (o) => JSON.stringify({ app: APP, type: 'hotkeys', format: 1, extensionVersion: '2.6.0', data: { a: 1 }, ...o });

test('envelope: поля конверта', () => {
  assert.deepEqual(envelope('theme', 3, { x: 1 }, '2.6.0'),
    { app: 'airnook-bookmarks', type: 'theme', format: 3, extensionVersion: '2.6.0', data: { x: 1 } });
});

test('readSettingsFile: туда и обратно, формат 1 без изменений', () => {
  const data = { preset: 'vim', keymap: { open: ['o'] } };
  const text = JSON.stringify(envelope('hotkeys', 1, data, '2.6.0'));
  assert.deepEqual(readSettingsFile(text, 'hotkeys', 1), { data });
});

test('readSettingsFile: цепочка миграций по format', () => {
  const chain = { 1: d => ({ ...d, b: 2 }), 2: d => ({ ...d, c: 3 }) };
  assert.deepEqual(readSettingsFile(file({ format: 1 }), 'hotkeys', 3, chain), { data: { a: 1, b: 2, c: 3 } });
  assert.deepEqual(readSettingsFile(file({ format: 2 }), 'hotkeys', 3, chain), { data: { a: 1, c: 3 } });
  assert.deepEqual(readSettingsFile(file({ format: 3 }), 'hotkeys', 3, chain), { data: { a: 1 } });
});

test('readSettingsFile: новее, чужой тип, битый файл', () => {
  assert.deepEqual(readSettingsFile(file({ format: 2 }), 'hotkeys', 1), { error: 'newer' });
  assert.deepEqual(readSettingsFile(file({ type: 'theme' }), 'hotkeys', 1), { error: 'wrong_type' });
  for (const bad of ['{', 'null', '5', file({ app: 'other' }), file({ format: 'x' }), file({ format: 0 }), file({ data: null }), file({ data: 5 })]) {
    assert.deepEqual(readSettingsFile(bad, 'hotkeys', 1), { error: 'broken' }, bad);
  }
});

test('cleanHotkeys: годное остаётся как есть', () => {
  const keymap = structuredClone(PRESETS.vim);
  assert.deepEqual(cleanHotkeys({ preset: 'vim', keymap }), { preset: 'vim', keymap, dropped: 0 });
});

test('cleanHotkeys: неизвестное и негодное отбрасывается и считается', () => {
  const out = cleanHotkeys({ preset: 'nope', keymap: { open: ['o', 5, ''], nothing: ['x'], delete: 'd' } });
  assert.deepEqual(out, { preset: 'default', keymap: { open: ['o'] }, dropped: 5 });
});

test('cleanHotkeys: keymap не объект — null', () => {
  for (const keymap of [undefined, null, [], 'x']) assert.equal(cleanHotkeys({ preset: 'vim', keymap }), null);
});

test('cleanHotkeys: зарезервированное и список из одного мусора не стирают клавиши', () => {
  const out = cleanHotkeys({ preset: 'vim', keymap: { open: [5], delete: ['Mod+t', 'x'], rename: [] } });
  assert.deepEqual(out, { preset: 'vim', keymap: { delete: ['x'], rename: [] }, dropped: 2 });
});

test('readSettingsFile: нет шага цепочки — broken, а не исключение', () => {
  assert.deepEqual(readSettingsFile(file({ format: 1 }), 'hotkeys', 3, { 2: d => d }), { error: 'broken' });
  assert.deepEqual(readSettingsFile(file({ format: 1 }), 'hotkeys', 2), { error: 'broken' });
});

test('cleanHotkeys: набор custom — свои сочетания, не отброшенное', () => {
  assert.deepEqual(cleanHotkeys({ preset: 'custom', keymap: { open: ['x'] } }), { preset: 'default', keymap: { open: ['x'] }, dropped: 0 });
});
