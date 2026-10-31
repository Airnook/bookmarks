// Закладки: чтение дерева, кэш узлов и адресов, отмеченное.
import { plural, t } from '../i18n.js';
import { exactUrl, looseUrl, trimUrlCache } from './url.js';
import { bookmarksIn } from './nodes.js';
import { state } from './state.js';
import { isEditing } from './ui.js';

export const findByUrl = (u) => state.bookmarkByUrl.get(exactUrl(u)) ?? state.bookmarkByUrl.get('~' + looseUrl(u));

export const sizeOf = (folder) => state.sizes.get(folder.id) ?? bookmarksIn([folder]).length;
export const folderSize = (folder) => { const n = sizeOf(folder); return n ? plural('bookmarks', n) : t('folder_empty'); };

// Узел, чьи дети — верхний уровень списка: стартовая папка из настроек
// (её могли удалить — тогда корень всех закладок)
const loadBase = async () =>
  (state.settings.rootId && await chrome.bookmarks.getSubTree(state.settings.rootId).then(([r]) => r, () => null))
  || (await chrome.bookmarks.getTree())[0];

// Дерево перечитываем при изменениях закладок и настроек; раскрытие папок
// и движение курсора работают с кэшем. Читаем не больше одного раза одновременно:
// изменения, пришедшие во время чтения, дают ещё ровно одно чтение после него.
// Свои правки ждут fetchTree() — и получают дерево уже с ними.
let reloading = null;      // обещание идущего чтения
let again = false;         // пока читали, что-то поменялось
let readStartedAt = 0;     // когда началось последнее чтение
let freshAt = 0;           // когда началось последнее чтение, которое дошло до списка
let changedAt = 0;         // когда пришло последнее событие закладок
let importing = false;     // идёт импорт — сотни событий, читаем один раз в конце

export function fetchTree() {
  if (reloading) { again = true; return reloading; }
  reloading = (async () => {
    do {
      again = false;
      const startedAt = readStartedAt = performance.now();
      const base = await loadBase();
      if (again) continue;
      if (isEditing()) { state.afterRename = true; return; } // поле ввода посреди переименования не перерисовываем
      applyTree(base);
      freshAt = startedAt;
    } while (again);
  })().catch(console.error).finally(() => { reloading = null; });
  return reloading;
}

// Дерево устарело? (событие пришло после начала последнего чтения)
export const ensureFresh = () => (reloading || changedAt > freshAt ? fetchTree() : Promise.resolve());

// События закладок (синхронизация, другие окна, свои правки): читаем с задержкой
// и не чаще пары раз в секунду — пачка событий даёт одно-два чтения. Свои правки
// не ждут этого: они сами вызывают fetchTree().
const RELOAD_EVERY = 700;
let reloadTimer = null;
function bookmarksChanged() {
  changedAt = performance.now();
  if (importing || reloadTimer) return;
  const wait = Math.max(150, readStartedAt + RELOAD_EVERY - changedAt);
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    if (changedAt > freshAt) fetchTree(); // уже прочитано свежее — не нужно
  }, wait);
}

function applyTree(base) {
  const inRoot = base.id !== '0'; // показываем стартовую папку, а не все закладки
  state.treeRoot = base;
  state.tree = inRoot ? base.children : base.children.filter(n => n.children.length); // пустые корневые папки прячем

  state.nodeById = new Map();
  state.sizes = new Map();
  state.bookmarkByUrl = new Map();
  state.bookmarkIds = new Set();
  (function index(nodes) {
    let count = 0;
    for (const n of nodes) {
      state.nodeById.set(n.id, n);
      if (!n.url) {
        const inside = index(n.children);
        state.sizes.set(n.id, inside);
        count += inside;
        continue;
      }
      count++;
      state.bookmarkIds.add(n.id);
      if (!state.bookmarkByUrl.has(exactUrl(n.url))) state.bookmarkByUrl.set(exactUrl(n.url), n.id);
      if (!state.bookmarkByUrl.has('~' + looseUrl(n.url))) state.bookmarkByUrl.set('~' + looseUrl(n.url), n.id);
    }
    return count;
  })(base.children);
  if (!inRoot) state.expanded = new Set([...state.expanded].filter(id => state.nodeById.has(id))); // удалённые папки забываем
  state.marked = new Set([...state.marked].filter(id => state.nodeById.has(id)));
  state.searchIndex = null;
  state.folderIndex = null;
  trimUrlCache(2 * state.bookmarkIds.size + 1000);

  treeApplied();
}

// Что сделать после каждого прочтения дерева — задаёт main.js (перерисовать список, вкладки,
// выбор папки): дерево не знает про отрисовку и не импортирует верхние модули
let treeApplied = () => {};
export const onTreeApplied = (callback) => { treeApplied = callback; };

// Раскрыть папку и всех её родителей, чтобы она была видна в списке
export function reveal(id) {
  for (let n = state.nodeById.get(id); n; n = state.nodeById.get(n.parentId)) if (!n.url) state.expanded.add(n.id);
}

// Отмеченные узлы в порядке дерева; содержимое отмеченной папки едет вместе с ней
export function markedNodes() {
  const out = [];
  (function walk(nodes) {
    for (const n of nodes) {
      if (state.marked.has(n.id)) out.push(n);
      else if (n.children) walk(n.children);
    }
  })(state.treeRoot?.children ?? []);
  return out;
}

// Сколько отмечено, если не считать отмеченное внутри отмеченных папок (без обхода всего дерева)
export function markedCount() {
  let count = 0;
  for (const id of state.marked) {
    let inside = false;
    for (let p = state.nodeById.get(state.nodeById.get(id)?.parentId); p && !inside; p = state.nodeById.get(p.parentId)) inside = state.marked.has(p.id);
    if (!inside) count++;
  }
  return count;
}

// С чем работают групповые действия: отмеченное или строка под курсором
export const targets = () => (state.marked.size ? markedNodes() : state.rows[state.sel] ? [state.rows[state.sel].node] : []);

export function listenBookmarks() {
  for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered']) {
    chrome.bookmarks[ev].addListener(bookmarksChanged);
  }
  chrome.bookmarks.onImportBegan.addListener(() => { importing = true; });
  chrome.bookmarks.onImportEnded.addListener(() => { importing = false; fetchTree(); });
}
