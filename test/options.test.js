import './locale-ru.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOptions } from './options-page.js';
import { PRESETS } from '../commands.js';

const folder = (id, title, children = []) => ({ id, title, children });
const makeTree = () => ({
  id: '0',
  children: [folder('1', 'Панель закладок', [folder('2', 'Работа')]), folder('3', 'Личное')],
});
const change = (newValue) => ({ oldValue: undefined, newValue });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function start(saved, more) {
  const tree = makeTree();
  const env = loadOptions({ tree, saved, ...more });
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

const row = (env, id) => env.find('keymap', 'cmd').find(r => r.dataset.id === id);
const click = (env, id, className) => row(env, id).children.flatMap(n => [n, ...(n.children ?? [])]).find(n => n.className === className).onclick();

test('клавиши: новая установка (keymap нет) — правка ложится поверх набора default', async () => {
  const env = await start({});
  click(env, 'move.to', 'add');
  env.keydown({ key: 'q', code: 'KeyQ' });
  env.keydown({ key: 'Enter', code: 'Enter' });
  await sleep(10);
  assert.deepEqual(env.store.keymap, { ...PRESETS.default, 'move.to': ['q'] });
});

test('клавиши: «сбросить» возвращает клавиши выбранного набора', async () => {
  const env = await start({ preset: 'default', keymap: { ...PRESETS.default, rename: ['F2', 'q'] } });
  assert.equal(row(env, 'delete').children[1].children.some(n => n.className === 'reset'), false); // как в наборе — сбрасывать нечего
  click(env, 'rename', 'reset');
  await sleep(10);
  assert.deepEqual(env.store.keymap, PRESETS.default);
});

test('клавиши: сочетание, которое забирает Chrome, не записывается — с объяснением', async () => {
  const env = await start({ keymap: {} });
  click(env, 'move.to', 'add');
  env.keydown({ key: 't', code: 'KeyT', ctrlKey: true });
  await sleep(10);
  assert.match(env.el('status').textContent, /Ctrl\+T/);
  assert.deepEqual(env.storageSets, []);
  env.keydown({ key: 'q', code: 'KeyQ' }); // запись продолжается
  env.keydown({ key: 'Enter', code: 'Enter' });
  await sleep(10);
  assert.deepEqual(env.store.keymap, { 'move.to': ['m', 'q'] });
});

test('клавиши: строка «открыть панель» — текущее сочетание и кнопка в настройки Chrome', async () => {
  const env = await start({}, { commands: [{ name: 'open-bookmarks', shortcut: 'Alt+Shift+B' }] });
  const global = env.find('keymap', 'cmd-global')[0];
  assert.ok(global);
  const all = (n) => [n, ...(n.children ?? []).flatMap(all)];
  assert.ok(all(global).some(n => n.textContent === 'Alt+Shift+B'));
  all(global).find(n => n.className === 'link').onclick();
  assert.deepEqual(env.opened, ['chrome://extensions/shortcuts']);
});

// ---------- файл с клавишами ----------

// Окно замены набора: ответ даёт тест
function stubDialog(env, answer) {
  const dlg = env.el('preset-dialog');
  dlg.querySelector = () => ({ focus() {} });
  dlg.showModal = () => { dlg.shown = true; setTimeout(() => { dlg.returnValue = answer; dlg.onclose(); }); };
  return dlg;
}
const pick = async (env, text) => {
  env.el('import-file').files = [{ name: 'bookmarks-hotkeys.json', text: async () => text }];
  await env.el('import-file').onchange();
  await sleep(20);
};

test('экспорт: bookmarks-hotkeys.json с набором, сочетаниями, форматом и версией', async () => {
  const env = await start({ preset: 'vim', keymap: PRESETS.vim });
  env.el('export').onclick();
  const [file] = env.downloads;
  assert.equal(file.name, 'bookmarks-hotkeys.json');
  assert.deepEqual(JSON.parse(file.text), {
    app: 'airnook-bookmarks', type: 'hotkeys', format: 1, extensionVersion: '2.6.0',
    data: { preset: 'vim', keymap: PRESETS.vim },
  });
});

test('импорт: экспортированный файл возвращает те же клавиши (после подтверждения)', async () => {
  const env = await start({ preset: 'vim', keymap: PRESETS.vim });
  env.el('export').onclick();
  const other = await start({ preset: 'arc', keymap: { open: ['x'] } });
  const dlg = stubDialog(other, 'ok');
  await pick(other, env.downloads[0].text);
  assert.ok(dlg.shown);
  assert.deepEqual(other.store.keymap, PRESETS.vim);
  assert.equal(other.store.preset, 'vim');
  assert.equal(other.el('status').textContent, 'Сочетания загружены');
});

test('импорт: отмена в окне ничего не меняет', async () => {
  const env = await start({ preset: 'vim', keymap: PRESETS.vim });
  env.el('export').onclick();
  const other = await start({ preset: 'arc', keymap: { open: ['x'] } });
  stubDialog(other, 'cancel');
  await pick(other, env.downloads[0].text);
  assert.deepEqual(other.store.keymap, { open: ['x'] });
  assert.deepEqual(other.storageSets, []);
});

test('импорт: негодные записи отбрасываются, пользователю говорим сколько', async () => {
  const env = await start({});
  stubDialog(env, 'ok');
  const file = { app: 'airnook-bookmarks', type: 'hotkeys', format: 1, data: { preset: 'vim', keymap: { open: ['o'], ghost: ['q'], delete: 5 } } };
  await pick(env, JSON.stringify(file));
  assert.deepEqual(env.store.keymap, { open: ['o'] });
  assert.match(env.el('status').textContent, /2/);
});

test('импорт: битый файл, чужой тип и новый формат — сообщение, хранилище не тронуто', async () => {
  const env = await start({ preset: 'arc', keymap: { open: ['x'] } });
  const dlg = stubDialog(env, 'ok');
  const base = { app: 'airnook-bookmarks', type: 'hotkeys', format: 1, data: { keymap: {} } };
  const messages = new Set();
  for (const text of ['{', JSON.stringify({ ...base, type: 'theme' }), JSON.stringify({ ...base, format: 2 })]) {
    await pick(env, text);
    messages.add(env.el('status').textContent);
  }
  assert.equal(messages.size, 3);
  assert.ok(!dlg.shown);
  assert.deepEqual(env.storageSets, []);
});
