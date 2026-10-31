import './locale-ru.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { firstLockedReason, lockedReason } from '../panel/nodes.js';

const system = { id: '1', parentId: '0', unmodifiable: true };
const managed = { id: '5', parentId: '2', unmodifiable: true };
const plain = { id: '7', parentId: '2' };

test('lockedReason: системная папка — свой текст для отметки и для правки', () => {
  assert.equal(lockedReason(system), 'Системные папки отметить нельзя');
  assert.equal(lockedReason(system, 'mark'), 'Системные папки отметить нельзя');
  assert.equal(lockedReason(system, 'edit'), 'Системные папки менять нельзя');
});

test('lockedReason: управляемая закладка — один текст для отметки и для правки', () => {
  assert.equal(lockedReason(managed, 'mark'), 'Эти закладки менять нельзя');
  assert.equal(lockedReason(managed, 'edit'), 'Эти закладки менять нельзя');
});

test('lockedReason: обычная закладка и папка — null', () => {
  assert.equal(lockedReason(plain, 'edit'), null);
  assert.equal(lockedReason({ id: '8', parentId: '2', children: [] }, 'edit'), null);
});

test('firstLockedReason: причина первого заблокированного, иначе null', () => {
  assert.equal(firstLockedReason([plain, managed, system], 'edit'), 'Эти закладки менять нельзя');
  assert.equal(firstLockedReason([system], 'edit'), 'Системные папки менять нельзя');
  assert.equal(firstLockedReason([plain], 'edit'), null);
  assert.equal(firstLockedReason([], 'edit'), null);
});
