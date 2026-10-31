// Открытие: папки в дереве, закладки во вкладках, наборы вкладок и группы.
import { groupName, promptDialog } from './dom.js';
import { plural, t } from '../i18n.js';
import { ignore } from './util.js';
import { isBookmarklet } from './url.js';
import { bookmarksIn } from './nodes.js';
import { saveState, state } from './state.js';
import { linkTab } from './tabs.js';
import { build } from './render.js';
import { leaveSearch } from './find.js';
import { clearMarks } from './marks.js';
import { flash, focusHome } from './ui.js';

const opening = new Set();      // закладки, для которых вкладка уже открывается

export function setOpen(node, open) {
  open ? state.expanded.add(node.id) : state.expanded.delete(node.id);
  saveState();
  build();
}

// Папку раскрыть/свернуть. Закладку открыть в текущей или новой вкладке —
// по настройке; flip (Cmd/Ctrl) меняет на противоположное; middle — всегда в новой,
// current — всегда в текущей. В режиме закреплённых вкладок уже открытую закладку
// не дублируем, а переключаемся на её вкладку (reset — вернуть на адрес закладки).
export function activate({ flip = false, middle = false, current = false, reset = false } = {}) {
  const { node } = state.rows[state.sel];
  if (state.search?.query) {
    // из найденного: папку показываем в дереве, закладку открываем и возвращаемся к дереву
    if (!node.url) return leaveSearch({ reveal: true, open: true });
    leaveSearch();
  } else if (state.search) {
    leaveSearch(); // строка поиска пустая — в ней дерево, действуем как обычно
  }
  if (!node.url) return setOpen(node, !state.expanded.has(node.id));
  const pinned = state.settings.pinnedTabs;

  const tabId = pinned && !flip && !middle && !current && state.openTabs.get(node.id)?.[0];
  if (tabId) {
    chrome.tabs.update(tabId, reset ? { active: true, url: node.url } : { active: true }).catch(ignore);
    return linkTab(tabId, node.id); // вкладка, найденная по адресу, теперь привязана к закладке
  }
  if (opening.has(node.id)) return; // повторное нажатие, пока вкладка открывается
  opening.add(node.id);
  let newTab = middle || (!current && state.settings.newTab !== flip);
  // текущая вкладка принадлежит другой закладке — не занимаем её, как в Arc
  // (если явно не попросили открыть именно здесь)
  if (pinned && !newTab && !current && state.activeBookmark && state.activeBookmark !== node.id) newTab = true;
  openInTab(node, newTab).finally(() => opening.delete(node.id));
}

const activeTab = () => chrome.tabs.query({ active: true, windowId: state.windowId }).then(([tab]) => tab ?? null, () => null);

// Новая вкладка встаёт рядом с текущей, а не в конец ряда
async function openInTab(node, newTab) {
  let tab = null;
  if (newTab) {
    const current = await activeTab();
    tab = await chrome.tabs.create({ url: node.url, windowId: state.windowId, ...(current && { index: current.index + 1 }) }).catch(() => null);
  } else {
    tab = await chrome.tabs.update({ url: node.url }).catch(() => null);
  }
  if (!state.settings.pinnedTabs || !tab) return;
  state.openTabs.set(node.id, [tab.id, ...(state.openTabs.get(node.id) ?? []).filter(id => id !== tab.id)]);
  await linkTab(tab.id, node.id);
}

// Открыть набор закладок (выбранное или папку): спросить название группы.
// Пусто — обычные вкладки, с названием — группа вкладок. Уже открытые
// (в режиме закреплённых вкладок) не дублируем — их вкладки идут в ту же группу.
// Закладки набора: без повторов и букмарклетов (им нужна открытая страница)
function setItems(nodes) {
  const seen = new Set();
  return bookmarksIn(nodes)
    .filter(n => !seen.has(n.id) && seen.add(n.id) && !isBookmarklet(n.url))
    .map(n => ({ id: n.id, url: n.url, tabId: state.settings.pinnedTabs ? state.openTabs.get(n.id)?.[0] : undefined }));
}
export const openableCount = (nodes) => setItems(nodes).length;

// открывает фоновый скрипт: вкладки уводят фокус, и панель с автоскрытием
// может закрыться, не доделав работу
function sendSet(items, group) {
  leaveSearch();
  chrome.runtime.sendMessage({ type: 'open-set', windowId: state.windowId, items, group, link: state.settings.pinnedTabs }).catch(ignore);
  if (state.marked.size) clearMarks();
}

// Открыть все закладки набора вкладками, без вопроса о группе («Открыть все» в меню)
export function openAll(nodes) {
  const items = setItems(nodes);
  if (items.length) sendSet(items, '');
}

export function askOpenSet(nodes, name = '') {
  const items = setItems(nodes);
  if (!items.length) return;
  const already = items.filter(i => i.tabId).length;
  promptDialog.querySelector('h2').textContent = plural('open_tabs', items.length) + (already ? ' ' + plural('open_tabs_already', already) : '');
  groupName.value = name;
  promptDialog.returnValue = '';
  promptDialog.onclose = () => {
    focusHome();
    if (promptDialog.returnValue === 'open') sendSet(items, groupName.value.trim());
  };
  promptDialog.showModal();
  groupName.select();
}

// Закладки набора — в новом окне; incognito — в окне инкогнито (если расширению это разрешено)
export function openInWindow(nodes, { incognito = false } = {}) {
  const url = setItems(nodes).map(i => i.url);
  if (url.length) chrome.windows.create({ url, incognito }).catch(() => flash(t('open_failed')));
}

// Закладка рядом с текущей вкладкой, в режиме разделения экрана (Split View, Chrome 155+)
export async function openInSplit(node) {
  const current = await activeTab();
  if (!current) return flash(t('open_failed'));
  chrome.tabs.create({ url: node.url, windowId: state.windowId, splitWithTabId: current.id }).catch(() => flash(t('open_failed')));
}

// Браузер умеет разделение экрана? Есть API или у вкладок есть splitViewId
export async function canSplit() {
  if (typeof chrome.tabs.createSplit === 'function') return true;
  const current = await activeTab();
  return !!current && 'splitViewId' in current;
}

// Менеджер закладок браузера на этой папке — новой вкладкой рядом с текущей
export async function openManager(folderId) {
  const url = 'chrome://bookmarks/' + (folderId && folderId !== '0' ? `?id=${folderId}` : '');
  const current = await activeTab();
  chrome.tabs.create({ url, windowId: state.windowId, ...(current && { index: current.index + 1 }) }).catch(() => flash(t('open_failed')));
}

export function closePanel() {
  state.winReady.then(() => chrome.sidePanel.close({ windowId: state.windowId })).catch(() => window.close());
}

export function listenGroupName() {
  groupName.addEventListener('keydown', (e) => {
    e.stopPropagation(); // иначе этот же Enter дойдёт до списка уже после закрытия окна
    if (e.defaultPrevented) return;
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); if (!e.repeat) promptDialog.close('open'); }
  });
}
