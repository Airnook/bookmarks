// Подпись кнопки с сочетанием активного набора: «Отменить (Ctrl+Z)», без сочетания — без скобок.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useLocale } from './i18n-stub.js';

useLocale('en');
const { withKey } = await import('../panel/keymap.js');
const { state } = await import('../panel/state.js');

test('withKey: есть сочетание — в скобках, нет — только название', () => {
  state.resolved = new Map([['undo', ['Mod+z']], ['redo', []]]);
  assert.match(withKey('Undo', 'undo'), /^Undo \(\u2068(Ctrl\+Z|⌘Z)\u2069\)$/);
  assert.equal(withKey('Redo', 'redo'), 'Redo');
  assert.equal(withKey('Nope', 'missing'), 'Nope');
});
