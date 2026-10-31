// Правка: переименование, окно «Изменить», новая папка и закладка, перемещение стрелками, удаление,
// адрес из вкладки, вырезать, копировать и вставить; отмена и повтор.
import { editDialog, editName, editUrl, editUrlRow, list } from './dom.js';
import { plural, t } from '../i18n.js';
import { ignore } from './util.js';
import { isBlankPage } from './url.js';
import { moveIndexes } from './place.js';
import { bookmarksIn, firstLockedReason, isLocked, label, lockedReason } from './nodes.js';
import { saveState, state } from './state.js';
import { ensureFresh, fetchTree, markedNodes, reveal, sizeOf, targets } from './tree.js';
import { linkTab } from './tabs.js';
import { begin, redo as redoStep, undo as undoStep } from './history.js';
import { clearClipboard, insideOf, pasteCopy, putInClipboard, readClipboard } from './clipboard.js';
import { build, select } from './render.js';
import { leaveSearch } from './find.js';
import { clearMarks } from './marks.js';
import { ask, flash, focusHome } from './ui.js';

// Переименование прямо в списке: Enter — сохранить, Esc — отменить, клик мимо — сохранить.
// created — папка только что создана: Esc отменяет создание (курсор возвращается
// на строку returnTo), пустое имя оставляет название по умолчанию («Новая папка»). typed — напечатанное,
// пока папка создавалась: { text, enter, cancel }. step — шаг истории новой папки: название
// входит в него, и он записывается, когда переименование закончено.
export function startRename({ created = false, returnTo = null, typed = null, step = null } = {}) {
  const { node } = state.rows[state.sel];
  if (isLocked(node)) return flash(lockedReason(node, 'edit'));
  const span = list.children[state.sel].querySelector('span');
  const input = Object.assign(document.createElement('input'), { className: 'rename', value: node.title });
  input.ariaLabel = t('rename_label');
  span.replaceWith(input);
  input.focus();
  if (typed?.text) input.value = typed.text;
  else input.select();

  let done = false;
  const finish = (save, refocus = true) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    input.replaceWith(span);
    if (refocus) focusHome(); // если фокус ушёл кликом в другое поле — не отбираем
    // отложенное на время переименования чтение — уже после сохранения, иначе мелькнёт старое
    const reload = () => { if (state.afterRename) { state.afterRename = false; fetchTree(); } };
    if (!save && created) {
      if (returnTo) state.selId = returnTo;
      state.afterRename = true; // отменённой папки не должно остаться в списке ни на миг
      // отмена создания — не правка: папку убираем мимо истории, её шаг не записываем
      return void chrome.bookmarks.remove(node.id).catch(ignore).finally(reload);
    }
    if (!save || value === node.title || (created && !value)) {
      if (step) saveStep(step, t('undo_folder_created', label(node)));
      return reload();
    }
    const renamed = { ...node, title: value };
    span.textContent = label(renamed);
    const edit = step ?? begin();
    edit.update(node.id, { title: value }).then((ok) => {
      if (!ok) span.textContent = label(node);
      const shown = ok ? renamed : node;
      if (step) saveStep(step, t('undo_folder_created', label(shown)));
      else if (ok) saveStep(edit, t('undo_renamed', label(shown)));
    }).finally(reload);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // клавиши в поле ввода не управляют списком
    if (e.isComposing) return; // Enter подтверждает ввод иероглифов, а не название
    if (e.defaultPrevented) return; // удержанный Enter из палитры не сохраняет сразу
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', (e) => finish(true, !e.relatedTarget));
  if (typed?.cancel) finish(false);
  else if (typed?.enter) finish(true);
}

// Изменения дерева из панели (перемещения, новые папки) идут по очереди:
// каждое начинается, когда предыдущее закончилось и список перерисован.
// droppable — шаг удержанной клавиши: если уже ждут два, лишние не копим.
let queue = Promise.resolve();
let queued = 0;
export function enqueue(task, droppable = false) {
  if (droppable && queued > 1) return false;
  queued++;
  queue = queue.then(task).catch(console.error).finally(() => queued--);
  return true;
}

// Куда встаёт новое и вставленное рядом со строкой node: в раскрытую (и в системную) папку — первым,
// иначе — следом за строкой; без строки (пустое место списка) — в конец верхнего уровня.
// index не задан — в конец папки.
export function placeNear(node) {
  if (!node) return { parentId: state.treeRoot.id === '0' ? '1' : state.treeRoot.id };
  if (!node.url && (node.parentId === '0' || (state.expanded.has(node.id) && !state.search?.query))) return { parentId: node.id, index: 0 };
  return { parentId: node.parentId, index: node.index + 1 };
}

// Папку туда класть нельзя (управляемая администратором)?
export const placeLocked = ({ parentId }) => !!(parentId === state.treeRoot?.id ? state.treeRoot : state.nodeById.get(parentId))?.unmodifiable;

// Новая папка: на раскрытой папке — первой внутри неё, иначе под курсором; place — в это место
// (меню на пустом месте списка). Если что-то отмечено — папка встаёт на место первого отмеченного,
// и всё отмеченное переезжает в неё. Пока папка создаётся, напечатанное
// копится и становится её названием (а не командами).
export function startNewFolder(place = null) {
  state.preparing = true;
  state.typeAhead = { text: '', enter: false };
  enqueue(() => newFolder(place).finally(() => { state.preparing = false; state.typeAhead = null; }));
}

async function newFolder(place) {
  const group = place ? [] : markedNodes().filter(n => !isLocked(n));
  const cur = state.rows[state.sel]?.node;
  const anchor = group[0] ?? cur;
  let parentId, index;
  if (place) ({ parentId, index } = place);
  else if (!anchor) [parentId, index] = [state.treeRoot.id === '0' ? '1' : state.treeRoot.id, 0];
  else if (group.length) [parentId, index] = [anchor.parentId, anchor.index];
  else ({ parentId, index } = placeNear(anchor));

  const step = begin(); // папка и перенос отмеченного в неё — один шаг
  const folder = await step.create({ parentId, ...(index !== undefined && { index }), title: t('new_folder_title') });
  if (!folder) return flash(t('create_folder_failed'));
  for (const n of group) await step.move(n.id, { parentId: folder.id });
  if (group.length) { state.marked.clear(); state.expanded.add(folder.id); }
  reveal(parentId);
  state.selId = folder.id;
  if (state.search) leaveSearch();
  await fetchTree();
  const i = state.rows.findIndex(r => r.node.id === folder.id);
  if (i < 0) return saveStep(step, t('undo_folder_created', label(folder)));
  select(i);
  const typed = state.typeAhead;
  state.preparing = false;
  state.typeAhead = null;
  startRename({ created: !group.length, returnTo: cur?.id, typed, step });
}

// Перемещение Option/Alt+↑↓ текущей строки или отмеченной группы. Как в аутлайнере:
// закладки и свёрнутые папки перешагиваем, в раскрытую папку заходим, на краю
// папки выходим наружу. Разбросанная группа собирается в один блок.
// Считаем от кэша, но сначала убеждаемся, что он свежий.
// repeat — шаг удержанной клавиши: причину заблокированной группы показываем только на первом нажатии;
// все шаги одного удержания — один шаг истории
let held = null;
export async function moveStep(dir, { repeat = false } = {}) {
  if (!repeat || !held) held = crypto.randomUUID();
  await ensureFresh();
  const base = state.treeRoot;
  const byId = (id) => (id === base.id ? base : state.nodeById.get(id));

  const ids = state.marked.size ? state.marked : new Set([state.selId]);
  const group = [];
  const locked = [];
  (function walk(nodes) {
    for (const n of nodes) {
      if (ids.has(n.id)) (isLocked(n) ? locked : group).push(n);
      else if (n.children) walk(n.children);
    }
  })(base.children);
  if (!group.length) {
    if (locked.length && !repeat) flash(firstLockedReason(locked, 'edit'));
    return;
  }

  const inGroup = new Set(group.map(n => n.id));
  const kids = (folder) => folder.children.filter(c => !inGroup.has(c.id));
  const canEnter = (n) => !n.url && !n.unmodifiable && state.expanded.has(n.id);

  // место блока: перед первым элементом группы, среди остальных детей папки
  const first = group[0];
  const parent = byId(first.parentId);
  const k = parent.children.slice(0, first.index).filter(c => !inGroup.has(c.id)).length;
  const siblings = kids(parent);

  let dest = null; // { folder, at }: встать в folder перед его at-м (не из группы) ребёнком
  if (dir > 0 ? k < siblings.length : k > 0) {
    const near = siblings[dir > 0 ? k : k - 1];
    dest = canEnter(near) ? { folder: near, at: dir > 0 ? 0 : kids(near).length } : { folder: parent, at: k + dir };
  } else if (parent.id !== base.id) {
    const grand = byId(parent.parentId);
    if (grand.id === '0') {
      // край системной папки — переходим в соседнюю видимую («Панель закладок» ↔ «Другие закладки»);
      // пустую скрытую («Мобильные закладки») не трогаем, иначе закладки «пропадут»
      const next = grand.children[parent.index + dir];
      if (next && (next.folderType === 'other' || state.tree.some(t => t.id === next.id))) {
        dest = { folder: next, at: dir > 0 ? 0 : kids(next).length };
      }
    } else {
      const at = kids(grand).indexOf(parent);
      dest = { folder: grand, at: dir > 0 ? at + 1 : at };
    }
  }
  if (!dest || dest.folder.unmodifiable) return;
  await moveGroup(group, dest.folder, kids(dest.folder)[dest.at]?.id ?? null, 'move:' + held);
}

// Перенести группу (узлы в порядке дерева) одним блоком в папку folder перед её ребёнком beforeId
// (null — в конец) — одним шагом истории; join — как в saveStep. Папка назначения и её родители
// раскрываются — блок не исчезает из вида; курсор едет вместе с блоком. Общий шаг для Alt+↑↓
// и перетаскивания мышью. Если порядок не изменился бы — ничего не делает.
export async function moveGroup(group, folder, beforeId, join = null) {
  const base = state.treeRoot;
  const byId = (id) => (id === base.id ? base : state.nodeById.get(id));
  const moves = moveIndexes(folder.children.map(c => c.id), group.map(n => n.id), beforeId);
  if (!moves.length) return;
  const step = begin();
  let failed = false;
  for (const { id, index } of moves) {
    if (!(await step.move(id, { parentId: folder.id, index }))) {
      failed = true;
      break;
    }
  }

  const [first] = group;
  for (let f = folder; f && f.id !== base.id && f.id !== '0'; f = byId(f.parentId)) state.expanded.add(f.id);
  if (!group.some(n => n.id === state.selId)) state.selId = first.id;
  state.scrollTarget = state.selId; // список могут перерисовать позже — тогда и докрутим
  saveState();
  await fetchTree();
  saveStep(step, failed ? t('move_failed') : group.length > 1 ? plural('undo_moved_items', group.length) : t('undo_moved', label(first)), join);
}

// Удаление с подтверждением (отмеченного или строки под курсором)
export async function askDelete() {
  const all = targets();
  const group = all.filter(n => !isLocked(n));
  if (!group.length) {
    const reason = firstLockedReason(all, 'edit');
    if (reason) flash(reason);
    return;
  }
  const [one] = group;
  const total = group.reduce((s, n) => s + (n.url ? 1 : sizeOf(n)), 0);
  const confirmed = await ask({
    title: group.length > 1
      ? plural('delete_items', group.length)
      : one.url ? (one.title ? t('delete_bookmark', one.title) : t('delete_untitled'))
      : t('delete_folder', label(one)),
    text: group.length > 1
      ? t('delete_items_total', total)
      : one.url ? one.url
      : total ? plural('delete_folder_contents', total)
      : one.children.length ? t('delete_only_empty_folders') : t('delete_folder_empty'),
    ok: t('delete'),
    danger: true,
    // несколько элементов или непустую папку одним Enter не удалить — по умолчанию отмена
    cancelFirst: group.length > 1 || (!one.url && one.children.length > 0),
  });
  if (!confirmed) return;
  moveCursorOff(group);
  if (state.marked.size) clearMarks();
  // удалённое исчезает сразу, не дожидаясь событий. По одному: история запоминает место
  // каждого среди оставшихся соседей и при отмене возвращает их в обратном порядке
  const step = begin();
  for (const n of group) await step.remove(n.id);
  await fetchTree();
  if (step.ops.length) saveStep(step, group.length > 1 ? plural('undo_deleted_items', group.length) : t('undo_deleted', label(one)));
}

// Курсор уходит со строк, которые сейчас исчезнут из этого места: на следующую
// строку того же уровня, иначе на строку выше. Сразу, а не после перерисовки:
// следующая команда, нажатая быстро, должна попасть уже на новую строку.
export function moveCursorOff(group) {
  const ids = new Set(group.map(n => n.id));
  const gone = (i) => { for (let n = state.rows[i].node; n; n = state.nodeById.get(n.parentId)) if (ids.has(n.id)) return true; return false; };
  const at = state.rows.findIndex(r => r.node.id === state.selId);
  if (at < 0 || !gone(at)) return; // курсор не на уходящем и не внутри уходящей папки
  let next = -1;
  for (let i = at + 1; i < state.rows.length && next < 0; i++) if (!gone(i) && state.rows[i].depth <= state.rows[at].depth) next = i;
  let prev = -1;
  for (let i = at - 1; i >= 0 && prev < 0; i--) if (!gone(i)) prev = i;
  const to = next >= 0 && state.rows[next].depth === state.rows[at].depth ? next : prev;
  if (to >= 0) select(to, false);
  else state.selId = null;
}

// Закладка под курсором получает адрес текущей вкладки (как «заменить адрес»
// у закреплённой вкладки Arc). Без вопроса — только если это вкладка самой закладки.
export async function updateUrlFromTab() {
  const node = state.rows[state.sel]?.node;
  if (!node) return;
  if (!node.url) return flash(t('url_only_bookmarks'));
  if (isLocked(node)) return flash(t('url_locked'));
  state.preparing = true; // пока узнаём адрес вкладки, клавиши не превращаются в команды
  const [tab] = await chrome.tabs.query({ active: true, windowId: state.windowId }).finally(() => { state.preparing = false; });
  if (tab?.pendingUrl && tab.pendingUrl !== tab.url) return flash(t('url_loading'));
  const url = tab?.url || '';
  if (isBlankPage(url)) return flash(t('url_blank_tab'));
  if (url === node.url) return flash(t('url_same'));
  const ownTab = state.openTabs.get(node.id)?.includes(tab.id);
  if (!ownTab && !(await ask({
    title: t('url_replace_title', label(node)),
    text: `${node.url}\n→ ${url}`,
    ok: t('url_replace'),
  }))) return;
  const step = begin();
  if (!(await step.update(node.id, { url }))) return flash(t('url_failed'));
  if (state.settings.pinnedTabs) linkTab(tab.id, node.id); // теперь это вкладка этой закладки
  saveStep(step, t('url_updated'));
}

// Новое или вставленное — на виду: папка, куда положили, раскрыта, курсор на первом из положенного
async function showPlaced(parentId, id) {
  if (state.search) leaveSearch();
  reveal(parentId);
  state.selId = state.scrollTarget = id;
  saveState();
  await fetchTree();
}

// Адреса закладок (и закладок внутри папок) — в системный буфер. Ответ — сколько адресов
export function copyAddresses(nodes) {
  const urls = bookmarksIn(nodes).map(n => n.url);
  return urls.length ? navigator.clipboard.writeText(urls.join('\n')).then(() => urls.length) : Promise.resolve(0);
}

// Вырезать или копировать отмеченное (или строку под курсором) в буфер закладок (clipboard.js).
// Копия кладёт и адреса в системный буфер, как «Копировать адрес». Вырезанное остаётся на месте
// до вставки; заблокированное вырезать нельзя.
export async function toClipboard(mode) {
  const all = targets();
  const group = mode === 'cut' ? all.filter(n => !isLocked(n)) : all;
  if (!group.length) {
    const reason = firstLockedReason(all, 'edit');
    return reason && flash(reason);
  }
  if (mode === 'copy') copyAddresses(group).catch(ignore); // сразу, пока нажатие ещё даёт доступ к буферу
  const count = await putInClipboard(group.map(n => n.id), mode).catch(() => -1);
  if (count < 0) return flash(t('copy_failed'));
  if (count) flash(t(mode === 'cut' ? 'clip_cut' : 'clip_copied', count));
}

// Вставить из буфера рядом со строкой node (см. placeNear), без строки — в конец верхнего уровня.
// Копия — новые узлы, вырезанное — перенос; вся вставка — один шаг истории.
export const paste = (node) => enqueue(() => pasteNear(node));

async function pasteNear(node) {
  const place = placeNear(node);
  if (placeLocked(place)) return flash(t('locked_managed'));
  const clip = await readClipboard();
  if (!clip) return flash(t('paste_empty'));
  if (clip.mode === 'cut') return pasteCut(clip, place);
  const step = begin();
  const r = await pasteCopy(step, clip, place);
  if (!r.ids.length) return flash(t('paste_failed'));
  await showPlaced(place.parentId, r.ids[0]);
  saveStep(step, t('undo_pasted', r.ids.length));
}

// Вырезанное — перенос одним блоком, как у Alt+↑↓ и мыши (moveGroup); после него буфер пуст
async function pasteCut(clip, place) {
  const ids = new Set(clip.items.map(i => i.id));
  if (await insideOf(place.parentId, ids)) return flash(t('paste_inside'));
  await ensureFresh();
  const folder = place.parentId === state.treeRoot.id ? state.treeRoot : state.nodeById.get(place.parentId);
  const group = clip.items.map(i => state.nodeById.get(i.id)).filter(n => n && !isLocked(n));
  if (!folder || !group.length) return flash(t('paste_failed'));
  const beforeId = place.index === undefined ? null : folder.children.slice(place.index).find(c => !ids.has(c.id))?.id ?? null;
  await clearClipboard();
  if (state.search) leaveSearch();
  await moveGroup(group, folder, beforeId);
}

// «Добавить страницу»: закладка на текущую вкладку (её название и адрес) рядом со строкой node
export const addPage = (node) => enqueue(() => addPageNear(node));

async function addPageNear(node) {
  const place = placeNear(node);
  if (placeLocked(place)) return flash(t('locked_managed'));
  state.preparing = true; // пока узнаём вкладку, клавиши не превращаются в команды
  const [tab] = await chrome.tabs.query({ active: true, windowId: state.windowId }).catch(() => []).finally(() => { state.preparing = false; });
  if (tab?.pendingUrl && tab.pendingUrl !== tab.url) return flash(t('url_loading'));
  const url = tab?.url || '';
  if (isBlankPage(url)) return flash(t('url_blank_tab'));
  const step = begin();
  const made = await step.create({ ...place, title: tab.title || '', url });
  if (!made) return flash(t('add_failed'));
  if (state.settings.pinnedTabs) linkTab(tab.id, made.id); // текущая вкладка — теперь вкладка этой закладки
  await showPlaced(place.parentId, made.id);
  saveStep(step, t('undo_added', label(made)));
}

// Адрес, набранный без схемы («example.com», «localhost:8080»), — как в адресной строке, по https
export function fixUrl(text) {
  const url = text.trim();
  if (!url) return '';
  return /^[a-z][a-z\d+.-]*:/i.test(url) && !/^[^/:]+:\d+(\/|$)/.test(url) ? url : `https://${url}`;
}

// Окно «Изменить»: название и адрес (у папки — только название). Enter — сохранить, Esc — отмена.
// Изменение — один шаг истории.
export function askEdit() {
  const node = state.rows[state.sel]?.node;
  if (!node) return;
  if (isLocked(node)) return flash(lockedReason(node, 'edit'));
  editDialog.querySelector('h2').textContent = node.url ? t('edit_bookmark') : t('edit_folder');
  editName.value = node.title;
  editUrl.value = node.url ?? '';
  editUrlRow.hidden = !node.url;
  editDialog.returnValue = '';
  editDialog.onclose = () => {
    focusHome();
    if (editDialog.returnValue !== 'save') return;
    const changes = {};
    const title = editName.value.trim();
    if (title !== node.title) changes.title = title;
    if (node.url) {
      const url = fixUrl(editUrl.value);
      if (!url) return flash(t('edit_failed'));
      if (url !== node.url) changes.url = url;
    }
    if (!Object.keys(changes).length) return;
    enqueue(async () => {
      const step = begin();
      if (!(await step.update(node.id, changes))) return flash(t('edit_failed'));
      await fetchTree();
      const shown = label({ ...node, ...changes });
      saveStep(step, changes.url ? t('undo_edited', shown) : t('undo_renamed', shown));
    });
  };
  editDialog.showModal();
  editName.select();
}

export function listenEditDialog() {
  for (const field of [editName, editUrl]) {
    field.addEventListener('keydown', (e) => {
      e.stopPropagation(); // клавиши в поле не управляют списком
      if (e.defaultPrevented) return;
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); if (!e.repeat) editDialog.close('save'); }
    });
  }
}

// Записать шаг правки в историю и сказать, что сделано, — с кнопкой «Отменить».
// Пустой шаг (ничего не изменилось) не записывается, сообщение — без кнопки.
// join — шаги с одним join подряд сливаются в один (см. history.js).
export function saveStep(step, text, join = null) {
  if (!step.ops.length) return flash(text);
  step.commit(text, join);
  flash(text, 6000, { text: t('undo_button'), label: t('undo_button_label', text), run: undo });
}

// Отмена и повтор — по той же очереди, что и правки. Восстановленные узлы получили новые id:
// курсор, отметки и раскрытые папки переходят на них. Курсор — на затронутый узел, его папка раскрыта.
export const undo = () => enqueue(() => replay(undoStep, { done: 'undone', empty: 'undo_nothing', partial: 'undo_partial', failed: 'undo_failed' }));
export const redo = () => enqueue(() => replay(redoStep, { done: 'redone', empty: 'redo_nothing', partial: 'redo_partial', failed: 'redo_failed' }));

async function replay(run, text) {
  const r = await run();
  if (r.status === 'empty') return flash(t(text.empty));
  const renew = (id) => r.map.get(id) ?? id;
  state.selId = renew(state.selId);
  state.marked = new Set([...state.marked].map(renew));
  state.expanded = new Set([...state.expanded].map(renew));
  await fetchTree();
  const focus = state.nodeById.get(r.focus);
  if (focus) {
    if (state.search) leaveSearch();
    reveal(focus.parentId);
    state.selId = state.scrollTarget = focus.id;
    saveState();
    build();
  }
  flash(r.status === 'failed' ? t(text.failed)
    : r.fallback ? t('history_fallback', label(r.fallback))
    : r.status === 'partial' ? t(text.partial)
    : t(text.done, r.label));
}
