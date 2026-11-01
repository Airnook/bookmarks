// Перетаскивание мышью: строку (отмеченную — со всеми отмеченными) выше, ниже или внутрь папки.
// Свои pointer events, а не HTML5 drag-and-drop: тот мешает клику и рисует призрак браузера.
// Перенос начинается после сдвига больше чем на DRAG_START px с зажатой левой кнопкой; простой
// и двойной клик, средняя кнопка, Shift/⌘-клик остаются как были (panel/mouse.js). В поиске
// (плоский список найденного) не работает. Esc — отмена; отпустили там, куда нельзя, — ничего.
// Куда встанет группа — dropTarget (place.js), сам перенос — moveGroup (edit.js), как у Alt+↑↓.
import { plural } from '../i18n.js';
import { list } from './dom.js';
import { isLocked, label } from './nodes.js';
import { dropTarget } from './place.js';
import { saveState, state } from './state.js';
import { ensureFresh, markedNodes } from './tree.js';
import { isEditing } from './ui.js';
import { build } from './render.js';
import { clearMarks } from './marks.js';
import { enqueue, moveGroup } from './edit.js';

const DRAG_START = 4;     // px: меньший сдвиг — ещё клик
const EXPAND_AFTER = 600; // мс над свёрнутой папкой — она раскрывается
const EDGE = 28;          // px у верхнего и нижнего края списка — автопрокрутка
const SCROLL_MAX = 14;    // px за кадр у самого края

// зажата кнопка над строкой: { id, x, y — где указатель, pointerId, started — тащим, cancelled — отменили
// или тащить нечего (до отпускания ничего не делаем), group, fromMarks — группа из отмеченных, target }
let press = null;
let suppress = false; // клик после переноса — не клик
const line = Object.assign(document.createElement('div'), { className: 'drop-line' });
line.ariaHidden = 'true';
const badge = Object.assign(document.createElement('div'), { id: 'drag-label' });
badge.ariaHidden = 'true';

const byId = (id) => (id === state.treeRoot?.id ? state.treeRoot : state.nodeById.get(id));

// Строка под указателем по высоте: { i, part } (i === rows.length — ниже последней) или null
function rowAt(y) {
  const box = list.getBoundingClientRect();
  const li = document.elementFromPoint(box.left + box.width / 2, y)?.closest('#list li[data-i]');
  if (li) {
    const r = li.getBoundingClientRect();
    return { i: +li.dataset.i, part: (y - r.top) / r.height };
  }
  const last = list.lastElementChild;
  return last?.dataset.i && y > last.getBoundingClientRect().bottom ? { i: state.rows.length, part: 0 } : null;
}

function paint(show) {
  list.querySelector('.drop-into')?.classList.remove('drop-into');
  line.remove();
  document.documentElement.classList.toggle('drop-none', !show);
  if (!show) return;
  const li = list.children[show.row];
  if (show.at === 'into') return li.classList.add('drop-into');
  line.classList.toggle('after', show.at === 'after');
  line.style.setProperty('--drop-depth', show.depth);
  li.append(line);
}

// Свёрнутая папка под указателем раскрывается через EXPAND_AFTER
let expandTimer = null;
let expandId = null;
function hoverFolder(id) {
  if (id === expandId) return;
  clearTimeout(expandTimer);
  expandId = id;
  if (!id) return;
  expandTimer = setTimeout(() => {
    if (!press?.started || state.expanded.has(id)) return;
    state.expanded.add(id);
    saveState();
    build();
    update();
  }, EXPAND_AFTER);
}

// Пересчитать цель по последнему положению указателя
function update() {
  badge.style.left = press.x + 'px';
  badge.style.top = press.y + 'px';
  const at = rowAt(press.y);
  press.target = at && dropTarget({
    rows: state.rows, ...at, group: press.group, byId, rootId: state.treeRoot.id, expanded: state.expanded,
  });
  paint(press.target?.show);
  const folder = press.target?.show.at === 'into' && byId(press.target.folderId);
  hoverFolder(folder && !state.expanded.has(folder.id) ? folder.id : null);
}

// Автопрокрутка, пока указатель у края списка: края — по scroll-padding страницы (сверху — строка поиска,
// снизу — полоса «Выбрано», пока есть отметки: строки под ней не видны, и туда не бросить)
let scrollFrame = 0;
function autoScroll() {
  scrollFrame = 0;
  if (!press?.started) return;
  const page = getComputedStyle(document.documentElement);
  const top = parseFloat(page.scrollPaddingTop) || 0;
  const bottom = innerHeight - (parseFloat(page.scrollPaddingBottom) || 0);
  const speed = (into) => Math.ceil(SCROLL_MAX * Math.min(1, into / EDGE));
  const by = press.y < top + EDGE ? -speed(top + EDGE - press.y) : press.y > bottom - EDGE ? speed(press.y - bottom + EDGE) : 0;
  if (!by) return;
  const was = scrollY;
  scrollBy(0, by);
  if (scrollY !== was) update();
  scrollFrame = requestAnimationFrame(autoScroll);
}

// Список перерисован (дерево перечиталось) — строки могли сдвинуться под неподвижным указателем
export function redrawDrag() {
  if (press?.started) update();
}

function start(e) {
  const node = state.nodeById.get(press.id);
  const fromMarks = !!node && state.marked.has(node.id);
  const group = !node ? [] : fromMarks ? markedNodes().filter(n => !isLocked(n)) : isLocked(node) ? [] : [node];
  if (!group.length) { // системную папку и управляемую закладку не перенести
    press.cancelled = true;
    list.classList.add('no-drag');
    return;
  }
  Object.assign(press, { started: true, group, fromMarks });
  list.setPointerCapture(e.pointerId);
  document.documentElement.classList.add('dragging');
  badge.textContent = group.length > 1 ? plural('drag_items', group.length) : label(group[0]);
  document.body.append(badge);
}

function finish() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  hoverFolder(null);
  paint(null);
  badge.remove();
  document.documentElement.classList.remove('dragging', 'drop-none');
  list.classList.remove('no-drag');
  if (list.hasPointerCapture(press.pointerId)) list.releasePointerCapture(press.pointerId);
}

function onDown(e) {
  if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  const li = e.target.closest('li[data-i]');
  if (!li || state.search || isEditing() || e.target.closest('.close, .rename')) return;
  press = { id: state.rows[+li.dataset.i]?.node.id, x: e.clientX, y: e.clientY, pointerId: e.pointerId, started: false, cancelled: false };
}

function onMove(e) {
  if (!press || e.pointerId !== press.pointerId || press.cancelled) return;
  if (!press.started) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) <= DRAG_START) return;
    start(e);
    if (!press.started) return;
  }
  Object.assign(press, { x: e.clientX, y: e.clientY });
  update();
  if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
}

function onUp(e) {
  if (!press || e.pointerId !== press.pointerId) return;
  const { started, cancelled, target, group, fromMarks } = press;
  if (started || cancelled) {
    suppress = true; // клик, который придёт следом, — конец переноса, а не открытие закладки
    setTimeout(() => { suppress = false; });
  }
  if (started) finish();
  list.classList.remove('no-drag');
  press = null;
  if (!started || cancelled || !target || e.type !== 'pointerup') return;
  const ids = group.map(n => n.id);
  enqueue(async () => {
    await ensureFresh(); // дерево могли поменять, пока тащили
    const nodes = ids.map(id => state.nodeById.get(id)).filter(n => n && !isLocked(n));
    const folder = byId(target.folderId);
    if (!nodes.length || !folder || folder.url) return;
    if (fromMarks && state.marked.size) clearMarks();
    state.selId = nodes[0].id; // курсор — на перенесённое
    await moveGroup(nodes, folder, target.beforeId);
  });
}

// Esc отменяет перенос; остальные клавиши, пока тащим, ничего не делают
function onKey(e) {
  if (!press?.started) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key !== 'Escape') return;
  finish();
  Object.assign(press, { started: false, cancelled: true });
}

export function listenDrag() {
  list.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  addEventListener('keydown', onKey, true); // раньше клавиш панели (keydown документа)
  addEventListener('click', (e) => { if (suppress) { suppress = false; e.stopPropagation(); e.preventDefault(); } }, true);
  list.addEventListener('dragstart', (e) => e.preventDefault()); // иконки — картинки: браузер тащил бы их сам
}
