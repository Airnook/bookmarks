// История правок (panel/history.js) со стабом chrome.bookmarks и storage.session (bookmarks-stub.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeChrome } from './bookmarks-stub.js';

globalThis.chrome = makeChrome();
const history = await import('../panel/history.js');
await history.listenHistory();

// Каждый тест — с чистыми закладками и историей
async function fresh(build) {
  const c = makeChrome();
  Object.assign(globalThis.chrome, { bookmarks: c.bookmarks, storage: c.storage });
  await history.listenHistory();
  const ids = {};
  for (const [title, parent, url] of build) ids[title] = (await c.bookmarks.create({ parentId: ids[parent] ?? parent, title, url })).id;
  return { ...c, ids };
}

test('удаление папки с вложенными папками: отмена восстанавливает структуру, порядок, адреса и место', async () => {
  const c = await fresh([['x', '1', 'https://x/'], ['Work', '1'], ['a', 'Work', 'https://a/'], ['Sub', 'Work'], ['s', 'Sub', 'https://s/'], ['b', 'Work', 'https://b/'], ['y', '1', 'https://y/']]);
  const before = c.show();
  const step = history.begin();
  assert.equal(await step.remove(c.ids.Work), true);
  await step.commit('Deleted Work');
  assert.equal(c.show(), 'Bar[x,y]');
  assert.equal(history.canUndo(), true);
  assert.equal(history.undoLabel(), 'Deleted Work');

  const r = await history.undo();
  assert.equal(r.status, 'done');
  assert.equal(c.show(), before);
  const work = c.byTitle('Work');
  assert.notEqual(work, c.ids.Work);
  assert.equal(r.focus, work);
  assert.equal(r.map.get(c.ids.Work), work);
  assert.equal(c.nodes.get(c.byTitle('s')).url, 'https://s/');
  assert.equal(history.canUndo(), false);
  assert.equal(history.redoLabel(), 'Deleted Work');
});

test('соответствие id: повтор после отмены после повтора попадает в новый узел', async () => {
  const c = await fresh([['Work', '1'], ['a', 'Work', 'https://a/'], ['z', '1', 'https://z/']]);
  const step = history.begin();
  await step.remove(c.ids.Work);
  await step.commit('del');
  await history.undo();
  assert.equal(c.show(), 'Bar[Work[a],z]');
  assert.equal((await history.redo()).status, 'done');
  assert.equal(c.show(), 'Bar[z]');
  await history.undo();
  assert.equal(c.show(), 'Bar[Work[a],z]');
});

test('соответствие id: более ранний шаг попадает в восстановленный узел', async () => {
  const c = await fresh([['Work', '1'], ['a', 'Work', 'https://a/'], ['z', '1', 'https://z/']]);
  const s1 = history.begin();
  await s1.update(c.ids.a, { title: 'A' });
  await s1.commit('ren');
  const s2 = history.begin();
  await s2.remove(c.ids.Work);
  await s2.commit('del');
  await history.undo(); // Work и A — с новыми id
  assert.equal((await history.undo()).status, 'done'); // переименование — уже в новом id
  assert.equal(c.show(), 'Bar[Work[a],z]');
  await history.redo();
  await history.redo();
  assert.equal(c.show(), 'Bar[z]');
  await history.undo();
  assert.equal(c.show(), 'Bar[Work[A],z]');
});

test('связи вкладок переходят к восстановленной закладке', async () => {
  const c = await fresh([['a', '1', 'https://a/']]);
  await c.storage.session.set({ 'link:7': c.ids.a, 'link:8': 'other' });
  const step = history.begin();
  await step.remove(c.ids.a);
  await step.commit('del');
  const r = await history.undo();
  assert.equal(c.session['link:7'], r.focus);
  assert.equal(c.session['link:8'], 'other');
});

test('переименование и адрес: отмена и повтор', async () => {
  const c = await fresh([['a', '1', 'https://a/']]);
  const step = history.begin();
  await step.update(c.ids.a, { title: 'b' });
  await step.commit('ren');
  const s2 = history.begin();
  await s2.update(c.ids.a, { url: 'https://new/' });
  await s2.commit('url');
  await history.undo();
  assert.equal(c.nodes.get(c.ids.a).url, 'https://a/');
  await history.undo();
  assert.equal(c.nodes.get(c.ids.a).title, 'a');
  await history.redo();
  await history.redo();
  assert.deepEqual([c.nodes.get(c.ids.a).title, c.nodes.get(c.ids.a).url], ['b', 'https://new/']);
});

test('перемещение группы — один шаг; отмена возвращает порядок и место', async () => {
  const c = await fresh([['a', '1', 'https://a/'], ['b', '1', 'https://b/'], ['c', '1', 'https://c/'], ['d', '1', 'https://d/'], ['F', '2']]);
  const step = history.begin();
  for (const id of [c.ids.a, c.ids.c]) await step.move(id, { parentId: c.ids.F });
  await step.commit('moved 2');
  assert.equal(c.show('2'), 'Other[F[a,c]]');
  await history.undo();
  assert.equal(c.show(), 'Bar[a,b,c,d]');
  assert.equal(history.canUndo(), false);
  await history.redo();
  assert.equal(c.show('2'), 'Other[F[a,c]]');
  // вниз в той же папке (браузер вычитает единицу) и обратно
  const s2 = history.begin();
  await s2.move(c.ids.b, { parentId: '1', index: 2 });
  await s2.commit('down');
  assert.equal(c.show(), 'Bar[d,b]');
  await history.undo();
  assert.equal(c.show(), 'Bar[b,d]');
  await history.redo();
  assert.equal(c.show(), 'Bar[d,b]');
});

test('новая папка с отмеченным — один шаг: отмена убирает папку и возвращает отмеченное', async () => {
  const c = await fresh([['a', '1', 'https://a/'], ['b', '1', 'https://b/'], ['c', '1', 'https://c/']]);
  const step = history.begin();
  const folder = await step.create({ parentId: '1', index: 0, title: 'New' });
  for (const id of [c.ids.a, c.ids.c]) await step.move(id, { parentId: folder.id });
  await step.update(folder.id, { title: 'Named' });
  await step.commit('created');
  assert.equal(c.show(), 'Bar[Named[a,c],b]');
  await history.undo();
  assert.equal(c.show(), 'Bar[a,b,c]');
  await history.redo();
  assert.equal(c.show(), 'Bar[Named[a,c],b]');
  await history.undo();
  assert.equal(c.show(), 'Bar[a,b,c]');
});

test('удаление нескольких — один шаг, места соседей восстанавливаются', async () => {
  const c = await fresh([['a', '1', 'https://a/'], ['b', '1', 'https://b/'], ['c', '1', 'https://c/'], ['d', '1', 'https://d/'], ['e', '1', 'https://e/']]);
  const step = history.begin();
  for (const id of [c.ids.b, c.ids.d, c.ids.e]) await step.remove(id);
  await step.commit('del 3');
  assert.equal(c.show(), 'Bar[a,c]');
  const r = await history.undo();
  assert.equal(c.show(), 'Bar[a,b,c,d,e]');
  assert.equal(r.focus, c.byTitle('b')); // курсор — на первое удалённое
  assert.equal(history.canUndo(), false);
});

test('новая правка очищает повтор; не больше 50 шагов', async () => {
  const c = await fresh([['a', '1', 'https://a/']]);
  for (let i = 0; i < 55; i++) {
    const step = history.begin();
    await step.update(c.ids.a, { title: `t${i}` });
    await step.commit(`ren ${i}`);
  }
  let h = c.session.history;
  assert.equal(h.undo.length, history.MAX_STEPS);
  assert.equal(h.undo[0].label, 'ren 5');
  await history.undo();
  assert.equal(history.canRedo(), true);
  const step = history.begin();
  await step.update(c.ids.a, { title: 'other' });
  await step.commit('new');
  h = c.session.history;
  assert.equal(h.redo.length, 0);
  assert.equal(history.canRedo(), false);
  assert.equal(history.undoLabel(), 'new');
});

test('пустой шаг не записывается; шаги с одним join сливаются', async () => {
  const c = await fresh([['a', '1', 'https://a/'], ['b', '1', 'https://b/'], ['c', '1', 'https://c/']]);
  await history.begin().commit('nothing');
  assert.equal(history.canUndo(), false);
  for (let i = 0; i < 2; i++) {
    const step = history.begin();
    await step.move(c.ids.a, { parentId: '1', index: i + 2 });
    await step.commit('down', 'move:a');
  }
  assert.equal(c.show(), 'Bar[b,c,a]');
  assert.equal(c.session.history.undo.length, 1);
  await history.undo();
  assert.equal(c.show(), 'Bar[a,b,c]');
});

test('отмена при пустой истории — empty', async () => {
  await fresh([]);
  assert.equal((await history.undo()).status, 'empty');
  assert.equal((await history.redo()).status, 'empty');
});

test('шаг стал невозможен: без исключения, с отчётом; изменённое в другом окне не затирается', async () => {
  const c = await fresh([['a', '1', 'https://a/'], ['b', '1', 'https://b/']]);
  const step = history.begin();
  await step.update(c.ids.a, { title: 'A' });
  await step.update(c.ids.b, { title: 'B' });
  await step.commit('ren 2');
  await c.bookmarks.update(c.ids.a, { title: 'elsewhere' }); // другое окно
  const r = await history.undo();
  assert.equal(r.status, 'partial');
  assert.equal(c.show(), 'Bar[elsewhere,b]');

  const s2 = history.begin();
  await s2.update(c.ids.b, { title: 'C' });
  await s2.commit('ren');
  await c.bookmarks.remove(c.ids.b); // удалили извне
  const r2 = await history.undo();
  assert.equal(r2.status, 'failed');
  assert.equal(history.canRedo(), false, 'невыполнимый шаг забыт');
});

test('исходной папки нет — восстанавливаем в ближайшего сохранившегося предка', async () => {
  const c = await fresh([['P', '1'], ['Q', 'P'], ['a', 'Q', 'https://a/'], ['b', '1', 'https://b/']]);
  const step = history.begin();
  await step.remove(c.ids.a);
  await step.commit('del a');
  await c.bookmarks.removeTree(c.ids.Q); // извне
  const r = await history.undo();
  assert.equal(r.status, 'done');
  assert.equal(r.fallback.id, c.ids.P);
  assert.equal(c.show(), 'Bar[P[a],b]');

});

test('созданную папку, в которую положили что-то извне, отмена не удаляет', async () => {
  const c = await fresh([['x', '2', 'https://x/']]);
  const step = history.begin();
  const folder = await step.create({ parentId: '1', title: 'F' });
  await step.commit('created');
  await c.bookmarks.move(c.ids.x, { parentId: folder.id });
  const r = await history.undo();
  assert.equal(r.status, 'failed');
  assert.equal(c.show(), 'Bar[F[x]]');
});

test('onHistoryChange: слушатель вызывается при правке, отмене, повторе и записи из другого окна', async () => {
  const c = await fresh([['x', '1', 'https://x/']]);
  const seen = [];
  history.onHistoryChange(() => seen.push([history.canUndo(), history.canRedo()]));
  const step = history.begin();
  await step.update(c.ids.x, { title: 'y' });
  await step.commit('renamed');
  await history.undo();
  await history.redo();
  assert.ok(seen.some(([u, r]) => u && !r), 'после правки можно отменить');
  assert.ok(seen.some(([u, r]) => !u && r), 'после отмены можно повторить');
  assert.deepEqual(seen.at(-1), [true, false]);
});
