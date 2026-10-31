// Команды панели: что делает каждая (названия и клавиши — в commands.js).
import { SETTINGS_DEFAULTS } from '../commands.js';
import { t } from '../i18n.js';
import { list } from './dom.js';
import { ignore } from './util.js';
import { isLocked, lockedReason } from './nodes.js';
import { saveState, state } from './state.js';
import { markedNodes, targets } from './tree.js';
import { closeTabs } from './tabs.js';
import { build, select } from './render.js';
import { leaveSearch, startSearch } from './find.js';
import { clearMarks, markOrExplain, paintMarks, setMark } from './marks.js';
import { activate, askOpenSet, closePanel, setOpen } from './open.js';
import {
  askDelete, askEdit, copyAddresses, enqueue, moveStep, paste, redo, startNewFolder, startRename, toClipboard, undo, updateUrlFromTab,
} from './edit.js';
import { askMoveTo } from './move-to.js';
import { flash } from './ui.js';
import { openPalette } from './palette.js';
import { openMenuAtCursor } from './context-menu.js';

const VIEWS = ['normal', 'detailed', 'dense']; // по кругу клавишей V
const viewName = (view) => ({ normal: t('view_normal'), detailed: t('view_detailed'), dense: t('view_dense') })[view];

const withCursor = (fn) => () => { const cur = state.rows[state.sel]?.node; if (cur) fn(cur); };
// Командам про устройство дерева (раскрыть, переместить, новая папка) нужно дерево:
// из поиска сначала показываем выбранное на его месте
const inTree = (fn) => (opts) => { if (state.search) leaveSearch({ reveal: true }); fn(opts); };

function openMarked() {
  const group = markedNodes();
  askOpenSet(group, group.length === 1 && !group[0].url ? group[0].title : '');
}

// Скопировать адреса закладки (отмеченных, закладок внутри папки)
function copyUrls() {
  copyAddresses(targets()).then(
    (n) => flash(!n ? t('no_bookmarks_here') : n > 1 ? t('copied_addresses', n) : t('copied_address')),
    () => flash(t('copy_failed')));
}

// Вид списка: обычный, с адресом под названием, компактный
export function applyView() {
  if (!VIEWS.includes(state.settings.view)) state.settings.view = SETTINGS_DEFAULTS.view;
  list.dataset.view = state.settings.view;
}

// Каждая запись вида несёт метку `viewWrite` («панель:номер») — её onChanged придёт всегда,
// даже если значение `view` не меняется (метка меняется). Очереди нет: отличаем эхо своих
// записей по метке, а не по значению, поэтому одинаковый вид из двух окон не оставляет хвоста.
const PANEL_ID = crypto.randomUUID();
let viewSeq = 0;
let lastViewWrite = '';

// Вид сразу на экран (следующее V считает от него, а не ждёт onChanged), затем в хранилище — все окна переключатся вместе
function setView(view) {
  state.settings.view = view;
  applyView();
  build();
  lastViewWrite = `${PANEL_ID}:${++viewSeq}`;
  chrome.storage.local.set({ view, viewWrite: lastViewWrite }).catch(ignore);
}

// Вид из onChanged хранилища. Эхо своей записи, которая не последняя, не применяем: на экране уже
// более новый вид (двойное V: `normal → detailed → dense` — эхо `detailed` не откатит `dense`).
// Последнее эхо своей записи совпадает с экраном — пустой проход. Чужая запись (другое окно или
// страница настроек, у неё нет метки панели) применяется, если отличается от экрана.
// Порядок событий хранилища совпадает с порядком записей, поэтому последнее эхо всегда
// приводит экран к хранилищу. Чужое изменение, пришедшее между своими записями до их эха,
// на миг откатит экран, но последнее эхо своей записи вернёт его — расхождения не остаётся.
export function viewStored(view, write) {
  if (write?.startsWith(PANEL_ID + ':') && write !== lastViewWrite) return;
  if (view === state.settings.view) return;
  state.settings.view = view;
  applyView();
  build();
}

function cycleView() {
  const view = VIEWS[(VIEWS.indexOf(state.settings.view) + 1) % VIEWS.length];
  setView(view);
  flash(t('view_changed', viewName(view)));
}

async function openHelp() {
  const url = chrome.runtime.getURL('help.html');
  const target = state.showNews ? url + '#news' : url;
  state.showNews = false;
  const [open] = (await chrome.tabs.query({})).filter(t => (t.url || t.pendingUrl || '').startsWith(url));
  if (!open) return chrome.tabs.create({ url: target, windowId: state.windowId }).catch(ignore);
  chrome.tabs.update(open.id, target === url ? { active: true } : { active: true, url: target }).catch(ignore);
  chrome.windows.update(open.windowId, { focused: true }).catch(ignore);
}

// Что делает каждая команда. Названия и клавиши по умолчанию — в commands.js
export const actions = {
  'cursor.down': () => select(state.sel + 1),
  'cursor.up': () => select(state.sel - 1),
  'cursor.first': () => select(0),
  'cursor.last': () => select(state.rows.length - 1),
  'search': () => startSearch(),
  'folder.expand': inTree(withCursor((cur) => {
    if (cur.url) return;
    if (state.expanded.has(cur.id) && cur.children.length) select(state.sel + 1);
    else setOpen(cur, true);
  })),
  'folder.collapse': inTree(withCursor((cur) => {
    if (!cur.url && state.expanded.has(cur.id)) return setOpen(cur, false);
    const parent = state.rows.findIndex(r => r.node.id === cur.parentId);
    if (parent >= 0) select(parent);
  })),
  'folders.collapseAll': inTree(withCursor((cur) => {
    let top = cur; // курсор — на ту папку верхнего уровня, в которой он был
    while (state.nodeById.has(top.parentId)) top = state.nodeById.get(top.parentId);
    state.expanded.clear();
    state.selId = top.id;
    saveState();
    build();
    list.children[state.sel]?.scrollIntoView({ block: 'nearest' });
  })),

  'open': withCursor(() => (state.marked.size ? openMarked() : activate())),
  'open.alt': withCursor((cur) => (state.marked.size ? openMarked() : cur.url ? activate({ flip: true }) : askOpenSet([cur], cur.title))),
  'open.newTab': withCursor((cur) => (state.marked.size ? openMarked() : cur.url ? activate({ middle: true }) : askOpenSet([cur], cur.title))),
  'open.currentTab': withCursor(() => (state.marked.size ? openMarked() : activate({ current: true }))),
  'open.group': withCursor((cur) => (state.marked.size ? openMarked() : askOpenSet([cur], cur.url ? '' : cur.title))),
  'open.reset': withCursor(() => activate({ reset: true })),

  'mark.toggle': withCursor((cur) => markOrExplain(cur)),
  'mark.down': withCursor((cur) => { setMark(cur, true); select(state.sel + 1); setMark(state.rows[state.sel].node, true); }),
  'mark.up': withCursor((cur) => { setMark(cur, true); select(state.sel - 1); setMark(state.rows[state.sel].node, true); }),
  'mark.all': withCursor((cur) => {
    // все соседи курсора в его папке; если уже все отмечены — снять
    const parent = cur.parentId === state.treeRoot.id ? state.treeRoot : state.nodeById.get(cur.parentId);
    const siblings = (parent?.children ?? []).filter(n => !isLocked(n));
    const reason = lockedReason(cur, 'mark');
    if (!siblings.length && reason) return flash(reason);
    const all = siblings.every(n => state.marked.has(n.id));
    for (const n of siblings) all ? state.marked.delete(n.id) : state.marked.add(n.id);
    paintMarks();
    saveState();
  }),
  'mark.clear': () => clearMarks(),

  'move.up': inTree(({ repeat } = {}) => enqueue(() => moveStep(-1, { repeat }), true)),
  'move.down': inTree(({ repeat } = {}) => enqueue(() => moveStep(1, { repeat }), true)),
  'folder.new': inTree(() => startNewFolder()),
  'rename': withCursor(() => startRename()),
  'edit': withCursor(() => askEdit()),
  'delete': withCursor(() => askDelete()),
  'move.to': withCursor(() => askMoveTo()),
  'url.update': withCursor(() => updateUrlFromTab()),
  'copy.url': withCursor(() => copyUrls()),
  'cut': withCursor(() => toClipboard('cut')),
  'copy': withCursor(() => toClipboard('copy')),
  'paste': () => paste(state.rows[state.sel]?.node ?? null),
  'tab.close': withCursor(() => closeTabs(targets())),
  'undo': () => undo(),
  'redo': () => redo(),

  'palette': () => openPalette((id) => actions[id]?.()),
  'menu': () => openMenuAtCursor(),
  'view.cycle': () => cycleView(),
  'help': () => openHelp(),
  'settings': () => chrome.runtime.openOptionsPage(),
  'escape': () => (state.marked.size ? clearMarks() : state.search ? leaveSearch() : closePanel()),
  'panel.close': () => closePanel(),
};
