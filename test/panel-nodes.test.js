import './locale-ru.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { label, isLocked, bookmarksIn } from '../panel/nodes.js';

test('label: название, иначе сайт, иначе адрес; у папки без названия — «Без названия»', () => {
  assert.equal(label({ title: 'Почта', url: 'https://mail.example.com' }), 'Почта');
  assert.equal(label({ title: '', url: 'https://www.xn--e1afmkfd.xn--p1ai/x' }), 'пример.рф');
  assert.equal(label({ title: '', url: 'javascript:void(0)' }), 'букмарклет');
  assert.equal(label({ title: '', url: 'about:blank' }), 'about:blank');
  assert.equal(label({ title: '', children: [] }), 'Без названия');
});

test('isLocked: системные папки и управляемые закладки', () => {
  assert.ok(isLocked({ id: '1', parentId: '0' }));
  assert.ok(isLocked({ id: '9', parentId: '5', unmodifiable: 'managed' }));
  assert.ok(!isLocked({ id: '7', parentId: '1' }));
});

test('bookmarksIn: закладки среди узлов и внутри папок — в порядке дерева', () => {
  const b = (id) => ({ id, url: `https://e.com/${id}` });
  const nodes = [b('1'), { id: 'f', children: [b('2'), { id: 'g', children: [b('3')] }, { id: 'h' }] }, b('4')];
  assert.deepEqual(bookmarksIn(nodes).map(n => n.id), ['1', '2', '3', '4']);
  assert.deepEqual(bookmarksIn([]), []);
});
