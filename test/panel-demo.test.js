import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoChrome } from '../panel/demo.js';

const real = { i18n: { getMessage: () => 'x' }, runtime: { getURL: (p) => `chrome-extension://id/${p}` } };
const walk = (n) => [n, ...(n.children ?? []).flatMap(walk)];

test('демо: фиксированное дерево, чтение работает как у chrome.bookmarks', async () => {
  const demo = makeDemoChrome(real);
  const [root] = await demo.bookmarks.getTree();
  const all = walk(root);
  assert.ok(all.some(n => n.url) && all.some(n => n.children?.length > 1));
  const [first] = all.filter(n => n.url);
  assert.deepEqual((await demo.bookmarks.get(first.id))[0].url, first.url);
  assert.equal((await demo.bookmarks.getSubTree(root.children[0].id))[0].id, root.children[0].id);
  assert.ok((await demo.bookmarks.getChildren(root.children[0].id)).length);
});

test('демо: правки закладок не выполняются и дерево не меняют', async () => {
  const demo = makeDemoChrome(real);
  const before = JSON.stringify(await demo.bookmarks.getTree());
  for (const [method, args] of [['create', [{ title: 'x' }]], ['update', ['11', { title: 'x' }]], ['move', ['11', { parentId: '2' }]], ['remove', ['11']], ['removeTree', ['10']]]) {
    await assert.rejects(demo.bookmarks[method](...args), undefined, method);
  }
  assert.equal(JSON.stringify(await demo.bookmarks.getTree()), before);
});

test('демо: есть отмеченная закладка и закладка с открытой вкладкой', async () => {
  const demo = makeDemoChrome(real);
  const urls = walk((await demo.bookmarks.getTree())[0]).map(n => n.url);
  const [tab] = await demo.tabs.query({});
  assert.ok(urls.includes(tab.url));
  const { pinnedTabs } = await demo.storage.local.get({ pinnedTabs: false });
  assert.equal(pinnedTabs, true);
  const saved = JSON.parse(demo.localStorage.getItem('state'));
  assert.ok(saved.marked.length && saved.win === (await demo.windows.getCurrent()).id);
});

test('демо: тема приходит через storage.local и доходит до onChanged; реальное хранилище не трогается', async () => {
  const demo = makeDemoChrome(real);
  assert.deepEqual(await demo.storage.local.get('theme'), {});
  const seen = [];
  demo.storage.local.onChanged.addListener(c => seen.push(c.theme.newValue));
  await demo.storage.local.set({ theme: { mode: 'dark' } });
  assert.deepEqual(seen, [{ mode: 'dark' }]);
  assert.deepEqual(await demo.storage.local.get('theme'), { theme: { mode: 'dark' } });
  assert.equal(demo.i18n, real.i18n);
});
