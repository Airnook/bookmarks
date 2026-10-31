// Набор пунктов меню правой кнопкой (panel/menu-items.js) для закладки, папки, группы,
// пустого места и заблокированного узла.
import test from 'node:test';
import assert from 'node:assert/strict';
import { menuItems } from '../panel/menu-items.js';

const CTX = { count: 3, bookmarklet: false, locked: null, place: null, clipboard: 'copy', inside: false, split: true, incognito: true, undo: true, redo: false };
const ids = (items) => items.map(i => (i === '-' ? '-' : i.id));
const off = (items) => Object.fromEntries(items.filter(i => i !== '-' && i.reason).map(i => [i.id, i.reason]));
const TAIL = ['-', 'edit', '-', 'cut', 'copy', 'paste', '-', 'delete', '-', 'bookmark.add', 'folder.new', '-', 'manager', '-', 'undo', 'redo'];

test('закладка: пункты и разделители как в меню закладок браузера', () => {
  const items = menuItems('bookmark', CTX);
  assert.deepEqual(ids(items), ['open.newTab', 'open.newWindow', 'open.split', 'open.incognito', ...TAIL]);
  assert.deepEqual(off(items), { redo: 'redo' });
});

test('закладка: без разделения экрана — пункта нет; инкогнито не разрешён — неактивен', () => {
  const items = menuItems('bookmark', { ...CTX, split: false, incognito: false });
  assert.deepEqual(ids(items).slice(0, 4), ['open.newTab', 'open.newWindow', 'open.incognito', '-']);
  assert.equal(off(items)['open.incognito'], 'incognito');
});

test('букмарклет: открыть нельзя ни одним пунктом', () => {
  const r = off(menuItems('bookmark', { ...CTX, bookmarklet: true }));
  for (const id of ['open.newTab', 'open.newWindow', 'open.split', 'open.incognito']) assert.equal(r[id], 'bookmarklet', id);
});

test('папка и группа: «Открыть все», без разделения экрана; у группы «Изменить» неактивен', () => {
  const folder = menuItems('folder', { ...CTX, split: true });
  assert.deepEqual(ids(folder), ['open.all', 'open.allNewWindow', 'open.allIncognito', 'open.group', ...TAIL]);
  const group = menuItems('group', CTX);
  assert.deepEqual(ids(group), ids(folder));
  assert.equal(off(group).edit, 'one');
  const empty = off(menuItems('folder', { ...CTX, count: 0 }));
  for (const id of ['open.all', 'open.allNewWindow', 'open.allIncognito', 'open.group']) assert.equal(empty[id], 'nothing', id);
});

test('пустое место: вставить, добавить, менеджер, поиск, палитра, настройки, отмена', () => {
  const items = menuItems('empty', { ...CTX, redo: true });
  assert.deepEqual(ids(items), ['paste', '-', 'bookmark.add', 'folder.new', '-', 'manager', '-', 'search', 'palette', 'settings', '-', 'undo', 'redo']);
  assert.deepEqual(off(items), {});
});

test('заблокированный узел: менять нельзя — пункты неактивны с причиной, а не скрыты', () => {
  const items = menuItems('folder', { ...CTX, locked: 'system' });
  assert.deepEqual(ids(items), ['open.all', 'open.allNewWindow', 'open.allIncognito', 'open.group', ...TAIL]);
  assert.deepEqual(off(items), { edit: 'system', cut: 'system', delete: 'system', redo: 'redo' });
});

test('вставить: пустой буфер, управляемая папка, вырезанная папка внутрь себя', () => {
  assert.equal(off(menuItems('bookmark', { ...CTX, clipboard: 'empty' })).paste, 'clipboard');
  const managed = off(menuItems('bookmark', { ...CTX, place: 'managed' }));
  assert.deepEqual([managed.paste, managed['bookmark.add'], managed['folder.new']], ['managed', 'managed', 'managed']);
  assert.equal(off(menuItems('folder', { ...CTX, clipboard: 'cut', inside: true })).paste, 'inside');
  assert.equal(off(menuItems('empty', { ...CTX, undo: false })).undo, 'undo');
});
