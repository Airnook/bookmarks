// Граф статических импортов модулей панели не должен содержать циклов:
// нижние модули (state, url, tree …) не знают о верхних (actions, keys, main …).
// Разбираем `import … from './x.js'` и `export … from './x.js'` в panel/*.js,
// плюс общие ../commands.js и ../i18n.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const FROM = /^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gms;

// файл (путь от корня расширения) → файлы расширения, которые он импортирует
function importGraph() {
  const files = fs.readdirSync(path.join(root, 'panel')).filter(f => f.endsWith('.js')).map(f => `panel/${f}`);
  const graph = new Map();
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const deps = [];
    for (const m of source.matchAll(FROM)) {
      const spec = m[1] ?? m[2];
      if (!spec.startsWith('.')) continue; // пакеты и URL — не наши модули
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      assert.ok(fs.existsSync(path.join(root, target)), `${file}: нет файла ${spec}`);
      deps.push(target);
    }
    graph.set(file, deps);
  }
  return graph;
}

// Первый найденный цикл как список файлов (первый и последний совпадают) или null
function findCycle(graph) {
  const state = new Map(); // нет — не заходили, 1 — в обходе, 2 — готов
  const stack = [];
  const visit = (node) => {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === 1) return [...stack.slice(stack.indexOf(next)), next];
      if (!state.has(next)) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(node, 2);
    return null;
  };
  for (const node of graph.keys()) {
    if (state.has(node)) continue;
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

test('панель: в графе импортов нет циклов', () => {
  const graph = importGraph();
  assert.ok(graph.size > 15, `модулей панели: ${graph.size}`);
  assert.ok(graph.get('panel/main.js').includes('panel/tree.js'), 'разбор импортов видит panel/main.js → tree.js');
  assert.ok(graph.get('panel/state.js').includes('commands.js'), 'и общие ../commands.js');
  const cycle = findCycle(graph);
  assert.equal(cycle, null, `цикл импортов: ${cycle?.join(' → ')}`);
});

test('findCycle: находит цикл и не путает общий узел с циклом', () => {
  const g = (o) => new Map(Object.entries(o));
  assert.deepEqual(findCycle(g({ a: ['b'], b: ['c'], c: ['a'] })), ['a', 'b', 'c', 'a']);
  assert.deepEqual(findCycle(g({ a: ['a'] })), ['a', 'a']);
  assert.equal(findCycle(g({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] })), null);
});
