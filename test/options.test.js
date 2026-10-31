import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOptions } from './options-page.js';

const folder = (id, title, children = []) => ({ id, title, children });
const makeTree = () => ({
  id: '0',
  children: [folder('1', 'Панель закладок', [folder('2', 'Работа')]), folder('3', 'Личное')],
});
const change = (newValue) => ({ oldValue: undefined, newValue });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function start(saved) {
  const tree = makeTree();
  const env = loadOptions({ tree, saved });
  await sleep(10); // init() асинхронный
  return { ...env, tree };
}

const optionValues = (env) => env.el('root').children.map(o => o.value);

test('onChanged: настройки из другой вкладки или панели отражаются в элементах, хранилище не пишем', async () => {
  const env = await start({ rootId: '2', newTab: false, pinnedTabs: true, autoHide: false, view: 'normal' });

  env.emitChanged({
    rootId: change('3'), newTab: change(true), pinnedTabs: change(false), autoHide: change(true), view: change('dense'),
  });

  assert.equal(env.el('root').value, '3');
  assert.equal(env.el('newTab').checked, true);
  assert.equal(env.el('pinnedTabs').checked, false);
  assert.equal(env.el('autoHide').checked, true);
  assert.equal(env.el('view').value, 'dense');
  assert.deepEqual(env.storageSets, []);
});

test('onChanged: удалённое из хранилища значение — умолчание', async () => {
  const env = await start({ rootId: '2', newTab: true, pinnedTabs: false, autoHide: true, view: 'detailed' });

  env.emitChanged({
    rootId: { oldValue: '2' }, newTab: { oldValue: true }, pinnedTabs: { oldValue: false },
    autoHide: { oldValue: true }, view: { oldValue: 'detailed' },
  });

  assert.equal(env.el('root').value, '');
  assert.equal(env.el('newTab').checked, false);
  assert.equal(env.el('pinnedTabs').checked, true);
  assert.equal(env.el('autoHide').checked, false);
  assert.equal(env.el('view').value, 'normal');
  assert.deepEqual(env.storageSets, []);
});

test('список папок: пачка событий закладок даёт одну перестройку и сохраняет выбор', async () => {
  const env = await start({ rootId: '2' });
  assert.equal(env.el('root').value, '2');
  const before = env.counters.getTree;

  env.tree.children.push(folder('5', 'Новая'));
  for (let i = 0; i < 3; i++) env.emitBookmark('onCreated');
  await sleep(env.get('ROOTS_DELAY') + 50);

  assert.equal(env.counters.getTree - before, 1);
  assert.ok(optionValues(env).includes('5'));
  assert.equal(env.el('root').value, '2');
  assert.deepEqual(env.storageSets, []);
});

test('список папок: выбор пользователя переживает перестройку', async () => {
  const env = await start({ rootId: '2' });

  env.el('root').value = '3';
  env.el('root').onchange();
  env.tree.children.push(folder('5', 'Новая'));
  env.emitBookmark('onCreated');
  await sleep(env.get('ROOTS_DELAY') + 50);

  assert.equal(env.el('root').value, '3');
  assert.deepEqual(env.store.rootId, '3');
});

test('список папок: выбранная папка удалена — «Все закладки», хранилище не трогаем', async () => {
  const env = await start({ rootId: '2' });

  env.tree.children[0].children = []; // папка «Работа» удалена
  env.emitBookmark('onRemoved');
  await sleep(env.get('ROOTS_DELAY') + 50);

  assert.equal(env.el('root').value, '');
  assert.ok(!optionValues(env).includes('2'));
  assert.deepEqual(env.storageSets, []);
  assert.equal(env.store.rootId, '2');
});

test('импорт закладок: во время импорта список не перестраивается, одна перестройка в конце', async () => {
  const env = await start({ rootId: '2' });
  const before = env.counters.getTree;

  env.emitBookmark('onImportBegan');
  env.tree.children.push(folder('5', 'Импорт'));
  for (let i = 0; i < 5; i++) env.emitBookmark('onCreated');
  await sleep(env.get('ROOTS_DELAY') + 50);
  assert.equal(env.counters.getTree, before);

  env.emitBookmark('onImportEnded');
  await sleep(env.get('ROOTS_DELAY') + 50);
  assert.equal(env.counters.getTree - before, 1);
  assert.ok(optionValues(env).includes('5'));
  assert.equal(env.el('root').value, '2');
});

test('список папок: пока открыт выпадающий список, перестройка ждёт blur', async () => {
  const env = await start({ rootId: '2' });
  const before = env.counters.getTree;

  env.focusEl('root');
  env.tree.children.push(folder('5', 'Новая'));
  env.emitBookmark('onCreated');
  await sleep(env.get('ROOTS_DELAY') + 50);
  assert.equal(env.counters.getTree, before);
  assert.ok(!optionValues(env).includes('5'));

  env.blurEl('root');
  await sleep(10);
  assert.equal(env.counters.getTree - before, 1);
  assert.ok(optionValues(env).includes('5'));
  assert.equal(env.el('root').value, '2');
});
