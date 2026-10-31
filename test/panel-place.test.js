// Куда встаёт переносимое: цель перетаскивания (dropTarget) и индексы переноса группы (moveIndexes).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dropTarget, moveIndexes } from '../panel/place.js';

// Дерево: корень 0 → «Панель закладок» 1 и «Другие закладки» 2 (системные).
// 1: a, F (папка: f1, f2, G (папка: g1)), b, E (пустая папка), M (управляемая папка)
function tree() {
  const nodes = new Map();
  const add = (id, parentId, folder = false, extra = {}) => {
    const n = { id, parentId, title: id, ...(folder ? { children: [] } : { url: `https://${id}.example/` }), ...extra };
    nodes.set(id, n);
    if (parentId) {
      const p = nodes.get(parentId);
      n.index = p.children.length;
      p.children.push(n);
    }
    return n;
  };
  add('0', null, true);
  add('1', '0', true);
  add('2', '0', true);
  add('a', '1');
  add('F', '1', true);
  add('f1', 'F');
  add('f2', 'F');
  add('G', 'F', true);
  add('g1', 'G');
  add('b', '1');
  add('E', '1', true);
  add('M', '1', true, { unmodifiable: true });
  add('o', '2');
  return nodes;
}
const nodes = tree();
const byId = (id) => nodes.get(id);

// видимые строки при раскрытых expanded, как build() в render.js
function rowsOf(expanded) {
  const rows = [];
  (function walk(list, depth) {
    for (const node of list) {
      rows.push({ node, depth });
      if (node.children && expanded.has(node.id)) walk(node.children, depth + 1);
    }
  })(nodes.get('0').children, 0);
  return rows;
}
const target = (expandedIds, rowId, part, groupIds = ['a']) => {
  const expanded = new Set(expandedIds);
  const rows = rowsOf(expanded);
  const i = rowId === 'below' ? rows.length : rows.findIndex(r => r.node.id === rowId);
  assert.ok(i >= 0, rowId);
  return dropTarget({ rows, i, part, group: groupIds.map(byId), byId, rootId: '0', expanded });
};
const at = (t) => t && [t.folderId, t.beforeId, t.show.at, t.show.depth];

test('dropTarget: верхняя и нижняя четверть строки — перед ней и после неё, на её уровне', () => {
  assert.deepEqual(at(target(['1'], 'E', 0.1)), ['1', 'E', 'before', 1]);
  assert.deepEqual(at(target(['1'], 'E', 0.9)), ['1', 'M', 'after', 1]);
  assert.deepEqual(at(target(['1'], 'M', 0.9)), ['1', null, 'after', 1]); // после последней — в конец
});

test('dropTarget: закладка делится пополам — перед и после, внутрь её нельзя', () => {
  assert.deepEqual(at(target(['1'], 'b', 0.4)), ['1', 'b', 'before', 1]);
  assert.deepEqual(at(target(['1'], 'b', 0.6)), ['1', 'E', 'after', 1]);
});

test('dropTarget: середина свёрнутой папки — внутрь, в конец', () => {
  assert.deepEqual(at(target(['1'], 'F', 0.5)), ['F', null, 'into', 1]);
  assert.deepEqual(at(target(['1'], 'E', 0.5)), ['E', null, 'into', 1]); // пустая
});

test('dropTarget: раскрытая папка — внутрь, в начало; низ строки — линия под ней уровнем глубже', () => {
  assert.deepEqual(at(target(['1', 'F'], 'F', 0.5)), ['F', 'f1', 'into', 1]);
  assert.deepEqual(at(target(['1', 'F'], 'F', 0.9)), ['F', 'f1', 'after', 2]);
  assert.deepEqual(at(target(['1', 'F'], 'F', 0.1)), ['1', 'F', 'before', 1]); // верх — перед ней
  // первый ребёнок сам в группе — встать перед следующим
  assert.deepEqual(at(target(['1', 'F'], 'F', 0.5, ['f1'])), ['F', 'f2', 'into', 1]);
});

test('dropTarget: «после» пропускает перетаскиваемые соседние строки', () => {
  assert.deepEqual(at(target(['1'], 'F', 0.9, ['a', 'b'])), ['1', 'E', 'after', 1]);
});

test('dropTarget: нельзя в саму себя и во вложенные папки', () => {
  assert.equal(target(['1', 'F'], 'F', 0.5, ['F']), null);
  assert.equal(target(['1', 'F'], 'F', 0.1, ['F']), null);
  assert.equal(target(['1', 'F', 'G'], 'G', 0.5, ['F']), null);
  assert.equal(target(['1', 'F', 'G'], 'g1', 0.1, ['F']), null);
  assert.equal(target(['1'], 'a', 0.1, ['a']), null); // на свою же строку
});

test('dropTarget: нельзя в закрытую для изменений папку', () => {
  assert.equal(target(['1'], 'M', 0.5), null);
});

test('dropTarget: на уровень корня нельзя, в системную папку — можно', () => {
  assert.equal(target(['1'], '1', 0.1), null);
  assert.equal(target(['1'], '2', 0.9), null);
  assert.equal(target(['1'], 'below', 0), null); // ниже всех строк — конец корня
  assert.deepEqual(at(target(['1'], '2', 0.5)), ['2', null, 'into', 0]);
  assert.deepEqual(at(target(['1'], '1', 0.5)), ['1', 'F', 'into', 0]);
});

test('dropTarget: ниже всех строк в стартовой папке — в её конец, линия на верхнем уровне', () => {
  const expanded = new Set();
  const rows = nodes.get('F').children.map(node => ({ node, depth: 0 }));
  const t = dropTarget({ rows, i: rows.length, part: 0, group: [byId('a')], byId, rootId: 'F', expanded });
  assert.deepEqual(at(t), ['F', null, 'after', 0]);
  assert.equal(t.show.row, rows.length - 1);
});

test('dropTarget: зависит только от строки и высоты — не от направления письма', () => {
  // горизонтальной координаты нет вовсе: RTL зеркалит только отступ линии (CSS), не цель
  assert.deepEqual(Object.keys(target(['1'], 'b', 0.6)).sort(), ['beforeId', 'folderId', 'show']);
  assert.deepEqual(Object.keys(target(['1'], 'b', 0.6).show).sort(), ['at', 'depth', 'row']);
});

test('moveIndexes: ниже в той же папке — индексы с поправкой браузера', () => {
  // [a b c d e]: a, b перед e → браузер вычитает единицу сам, поэтому индекс — позиция e до переноса
  assert.deepEqual(moveIndexes(['a', 'b', 'c', 'd', 'e'], ['a', 'b'], 'e'), [{ id: 'a', index: 4 }, { id: 'b', index: 4 }]);
  // в конец
  assert.deepEqual(moveIndexes(['a', 'b', 'c'], ['a'], null), [{ id: 'a', index: 3 }]);
});

test('moveIndexes: выше в той же папке и из другой папки', () => {
  assert.deepEqual(moveIndexes(['a', 'b', 'c', 'd'], ['c', 'd'], 'a'), [{ id: 'c', index: 0 }, { id: 'd', index: 1 }]);
  assert.deepEqual(moveIndexes(['a', 'b'], ['x', 'y'], 'b'), [{ id: 'x', index: 1 }, { id: 'y', index: 2 }]);
  assert.deepEqual(moveIndexes([], ['x'], null), [{ id: 'x', index: 0 }]);
});

test('moveIndexes: разбросанная группа собирается в блок', () => {
  assert.deepEqual(moveIndexes(['a', 'b', 'c', 'd', 'e'], ['a', 'c'], 'e'), [{ id: 'a', index: 4 }, { id: 'c', index: 4 }]);
});

test('moveIndexes: порядок не меняется — пусто', () => {
  assert.deepEqual(moveIndexes(['a', 'b', 'c'], ['b'], 'c'), []);
  assert.deepEqual(moveIndexes(['a', 'b', 'c'], ['a', 'b'], 'c'), []);
  assert.deepEqual(moveIndexes(['a', 'b', 'c'], ['c'], null), []);
  assert.deepEqual(moveIndexes(['a', 'b', 'c'], ['b'], 'gone'), [{ id: 'b', index: 3 }]); // нет такого — в конец
});

// Проверка индексов на модели браузера: move(id, index) — как chrome.bookmarks.move
test('moveIndexes: на модели браузера группа встаёт блоком перед целью', () => {
  const browserMove = (order, id, index) => {
    const old = order.indexOf(id);
    if (old >= 0) { order.splice(old, 1); if (old < index) index--; }
    order.splice(index, 0, id);
  };
  const cases = [
    [['a', 'b', 'c', 'd', 'e'], ['b', 'd'], 'a', ['b', 'd', 'a', 'c', 'e']],
    [['a', 'b', 'c', 'd', 'e'], ['a', 'c'], 'e', ['b', 'd', 'a', 'c', 'e']],
    [['a', 'b', 'c', 'd', 'e'], ['b', 'c'], null, ['a', 'd', 'e', 'b', 'c']],
    [['a', 'b', 'c'], ['x', 'b'], 'a', ['x', 'b', 'a', 'c']],
  ];
  for (const [order, ids, before, want] of cases) {
    const got = [...order];
    for (const { id, index } of moveIndexes(order, ids, before)) browserMove(got, id, index);
    assert.deepEqual(got, want, `${ids} перед ${before}`);
  }
});
