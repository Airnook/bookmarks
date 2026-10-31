// Вкладки закладок (режим закреплённых вкладок): какие открыты, точки и крестики, закрытие.
import { list } from './dom.js';
import { plural, t } from '../i18n.js';
import { debounce, ignore } from './util.js';
import { bookmarksIn } from './nodes.js';
import { state } from './state.js';
import { findByUrl } from './tree.js';
import { ask, flash } from './ui.js';
import { keyText } from './keymap.js';

// Какие закладки открыты во вкладках этого окна. Вкладка относится к закладке,
// если открыта из панели (связь хранится, даже когда вкладка ушла на другой
// адрес — как закреплённая вкладка Arc) или просто совпадает по адресу.
// Связи лежат в storage.session отдельными ключами link:<id вкладки>, чтобы
// одновременные записи из разных окон не затирали друг друга; связи закрытых
// вкладок убирает фоновый скрипт.
let tabsSeq = 0;
export async function refreshTabs() {
  const seq = ++tabsSeq;
  if (!state.settings.pinnedTabs) {
    if (!state.openTabs.size) return; // режим выключен и отмечать нечего
    state.openTabs = new Map();
    state.activeBookmark = null;
    return paintTabs();
  }
  await state.winReady;
  const tabs = await chrome.tabs.query({ windowId: state.windowId });
  const stored = tabs.length ? await chrome.storage.session.get(tabs.map(t => 'link:' + t.id)) : {};
  if (seq !== tabsSeq) return;
  // у закладки может быть несколько вкладок: первой — текущая, потом недавние
  tabs.sort((a, b) => (b.active - a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
  const open = new Map();
  let active = null;
  for (const t of tabs) {
    const linked = stored['link:' + t.id];
    const id = state.bookmarkIds.has(linked) ? linked : findByUrl(t.url || t.pendingUrl); // закладку могли удалить
    if (!id) continue;
    open.set(id, [...(open.get(id) ?? []), t.id]);
    if (t.active) active = id;
  }
  state.openTabs = open;
  state.activeBookmark = active;
  paintTabs();
}
const scheduleTabs = debounce(refreshTabs, 50);

export const linkTab = (tabId, bookmarkId) =>
  chrome.storage.session.set({ ['link:' + tabId]: bookmarkId }).then(scheduleTabs, ignore);

// Закрыть вкладки закладок (и закладок внутри папок). Вкладки нескольких закладок — спросим.
export async function closeTabs(nodes) {
  const withTabs = bookmarksIn(nodes).filter(n => state.openTabs.has(n.id));
  const ids = withTabs.flatMap(n => state.openTabs.get(n.id));
  if (!ids.length) {
    const del = keyText('delete');
    return flash(state.settings.pinnedTabs ? t('tab_not_open') + (del ? ' · ' + t('tab_not_open_delete', del) : '') : t('tab_enable_pinned'));
  }
  if (withTabs.length > 1 && !(await ask({
    title: plural('close_tabs', ids.length),
    text: plural('close_tabs_text', withTabs.length),
    ok: t('close'),
  }))) return;
  chrome.tabs.remove(ids).catch(ignore);
}

// Точки и крестики без перестройки списка. У свёрнутой папки — кольцо,
// если внутри открыта какая-то закладка (синее — если текущая).
export function paintTabs() {
  const inside = new Set();
  const activeInside = new Set();
  for (const id of state.openTabs.keys()) {
    for (let p = state.nodeById.get(state.nodeById.get(id)?.parentId); p; p = state.nodeById.get(p.parentId)) {
      inside.add(p.id);
      if (id === state.activeBookmark) activeInside.add(p.id);
    }
  }
  state.rows.forEach(({ node }, i) => {
    const li = list.children[i];
    const open = state.openTabs.has(node.id);
    const folded = !node.url && !state.expanded.has(node.id) && !state.search?.query;
    li.classList.toggle('open', open);
    li.classList.toggle('active', node.id === state.activeBookmark);
    li.classList.toggle('inside', folded && inside.has(node.id));
    li.classList.toggle('active-inside', folded && activeInside.has(node.id));
    const btn = li.querySelector('.close');
    if (open && !btn) li.append(closeButton());
    else if (!open && btn) btn.remove();
  });
}

function closeButton() {
  const b = document.createElement('button');
  b.className = 'close';
  b.tabIndex = -1;
  b.title = t('close_tab');
  b.ariaLabel = t('close_tab');
  return b;
}

export function listenTabs() {
  for (const ev of ['onCreated', 'onRemoved', 'onActivated', 'onAttached', 'onDetached', 'onReplaced']) {
    chrome.tabs[ev].addListener(scheduleTabs);
  }
  chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.url) scheduleTabs(); });
}
