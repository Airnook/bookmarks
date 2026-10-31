// Буфер закладок (panel/clipboard.js): снимок поддерева, вставка копии одним шагом истории,
// вырезанное и проверка «папку — не в неё саму», общий для окон. Стаб chrome — bookmarks-stub.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeChrome } from './bookmarks-stub.js';

globalThis.chrome = makeChrome();
const history = await import('../panel/history.js');
// два окна — две копии модуля с общим storage.session
const one = await import('../panel/clipboard.js?one');
const two = await import('../panel/clipboard.js?two');

async function fresh(build) {
  const c = makeChrome();
  Object.assign(globalThis.chrome, { bookmarks: c.bookmarks, storage: c.storage });
  await Promise.all([history.listenHistory(), one.listenClipboard(), two.listenClipboard()]);
  const ids = {};
  for (const [title, parent, url] of build) ids[title] = (await c.bookmarks.create({ parentId: ids[parent] ?? parent, title, url })).id;
  return { ...c, ids };
}

const TREE = [['Work', '1'], ['a', 'Work', 'https://a/'], ['Sub', 'Work'], ['s', 'Sub', 'https://s/'], ['x', '1', 'https://x/'], ['Dest', '1']];

const paste = async (mod, place, step = history.begin()) => mod.pasteCopy(step, await mod.readClipboard(), place);

test('копировать папку → вставить: копия со всем содержимым; отмена убирает её одним шагом', async () => {
  const c = await fresh(TREE);
  assert.equal(one.clipboardEmpty(), true);
  assert.equal(await one.putInClipboard([c.ids.Work], 'copy'), 1);
  const step = history.begin();
  const r = await paste(one, { parentId: c.ids.Dest }, step);
  assert.equal(r.status, 'done');
  assert.equal(c.show(), 'Bar[Work[a,Sub[s]],x,Dest[Work[a,Sub[s]]]]');
  assert.notEqual(r.ids[0], c.ids.Work);
  assert.equal(c.nodes.get(c.byTitle('s')).url, 'https://s/');
  await step.commit('Pasted');
  assert.equal(one.clipboardEmpty(), false, 'копия остаётся в буфере — можно вставить ещё раз');
  assert.equal((await history.undo()).status, 'done');
  assert.equal(c.show(), 'Bar[Work[a,Sub[s]],x,Dest[]]');
});

test('снимок: копия вставляет то, что было при копировании, по месту и в порядке буфера', async () => {
  const c = await fresh([...TREE, ['d1', 'Dest', 'https://d1/'], ['d2', 'Dest', 'https://d2/']]);
  await one.putInClipboard([c.ids.x, c.ids.a], 'copy');
  await c.bookmarks.update(c.ids.a, { title: 'changed' });
  await c.bookmarks.removeTree(c.ids.x);
  await paste(one, { parentId: c.ids.Dest, index: 1 });
  assert.equal(c.show(c.ids.Dest), 'Dest[d1,x,a,d2]');
});

test('вырезать: в буфере id исходных узлов; после вставки буфер пуст во всех окнах', async () => {
  const c = await fresh(TREE);
  await one.putInClipboard([c.ids.x, c.ids.a], 'cut');
  assert.equal(one.clipboardMode(), 'cut');
  assert.equal(two.clipboardMode(), 'cut');
  assert.deepEqual(one.cutIds(), [c.ids.x, c.ids.a]);
  assert.deepEqual((await two.readClipboard()).items.map(i => i.id), [c.ids.x, c.ids.a]);
  await two.clearClipboard();
  assert.equal(one.clipboardEmpty(), true);
  assert.equal(await one.readClipboard(), null);
});

test('вырезанную папку нельзя вставить в неё саму и в её вложенную', async () => {
  const c = await fresh(TREE);
  const ids = new Set([c.ids.Work]);
  assert.equal(await one.insideOf(c.ids.Work, ids), true);
  assert.equal(await one.insideOf(c.ids.Sub, ids), true);
  assert.equal(await one.insideOf(c.ids.Dest, ids), false);
  assert.equal(await one.insideOf('1', ids), false);
});

test('буфер общий для окон: скопировали в одном — вставили в другом', async () => {
  const c = await fresh(TREE);
  assert.equal(two.clipboardEmpty(), true);
  await one.putInClipboard([c.ids.x], 'copy');
  assert.equal(two.clipboardEmpty(), false);
  assert.equal(two.clipboardMode(), 'copy');
  const r = await paste(two, { parentId: c.ids.Work, index: 0 });
  assert.equal(r.status, 'done');
  assert.equal(c.show(c.ids.Work), 'Work[x,a,Sub[s]]');
});

test('пустой буфер и исчезнувшие узлы', async () => {
  const c = await fresh(TREE);
  assert.equal(await one.readClipboard(), null);
  assert.equal(await one.putInClipboard(['404'], 'copy'), 0);
  assert.equal(one.clipboardEmpty(), true);
  assert.equal(await one.putInClipboard(['404', c.ids.a], 'copy'), 1);
});
