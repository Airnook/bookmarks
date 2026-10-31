// Меню правой кнопкой. Своё: встроенное меню закладок браузера расширению недоступно.
// Пункты, порядок и разделители — как у браузера (menu-items.js). Открывается правой кнопкой
// по строке или пустому месту списка и с клавиатуры (команда menu: Shift+F10, клавиша меню) —
// у строки под курсором. Пункты, которые есть в реестре команд, показывают их клавиши
// и выполняются той же командой (run задаёт main.js: меню не знает, где команды лежат).
import { COMMAND, bindingNodes, isRtl } from '../commands.js';
import { t } from '../i18n.js';
import { list, menu } from './dom.js';
import { isBookmarklet } from './url.js';
import { isLocked, label } from './nodes.js';
import { state } from './state.js';
import { canRedo, canUndo, redoLabel, undoLabel } from './history.js';
import { clipboardEmpty, clipboardMode, cutIds } from './clipboard.js';
import { markedCount, targets } from './tree.js';
import { keysOf } from './keymap.js';
import { select } from './render.js';
import { clearMarks } from './marks.js';
import { activate, canSplit, openAll, openInSplit, openInWindow, openManager, openableCount } from './open.js';
import { addPage, paste, placeLocked, placeNear, startNewFolder } from './edit.js';
import { focusHome } from './ui.js';
import { menuItems } from './menu-items.js';

let run = () => {};

// Что делает пункт: command — команда реестра (её клавиши видны справа; выполняется она,
// если нет своего do), do — своё действие с тем, для чего открыто меню (m — см. openMenu)
const ITEMS = {
  'open.newTab': { text: () => t('menu_open_new_tab'), command: 'open.newTab', do: () => activate({ middle: true }) },
  'open.newWindow': { text: () => t('menu_open_new_window'), do: (m) => openInWindow(m.nodes) },
  'open.split': { text: () => t('menu_open_split'), do: (m) => openInSplit(m.node) },
  'open.incognito': { text: () => t('menu_open_incognito'), do: (m) => openInWindow(m.nodes, { incognito: true }) },
  'open.all': { text: (m) => t('menu_open_all', m.ctx.count), do: (m) => openAll(m.nodes) },
  'open.allNewWindow': { text: () => t('menu_open_all_new_window'), do: (m) => openInWindow(m.nodes) },
  'open.allIncognito': { text: () => t('menu_open_all_incognito'), do: (m) => openInWindow(m.nodes, { incognito: true }) },
  'open.group': { text: () => COMMAND['open.group'].title, command: 'open.group' },
  'edit': { text: (m) => (m.what === 'folder' ? t('menu_rename') : t('menu_edit')), command: 'edit' },
  'cut': { text: () => COMMAND.cut.title, command: 'cut' },
  'copy': { text: () => COMMAND.copy.title, command: 'copy' },
  'paste': { text: () => COMMAND.paste.title, command: 'paste', do: (m) => paste(m.node) },
  'delete': { text: () => t('menu_delete'), command: 'delete' },
  'bookmark.add': { text: () => t('menu_add_page'), do: (m) => addPage(m.node) },
  'folder.new': { text: () => t('menu_add_folder'), command: 'folder.new', do: (m) => (m.node ? run('folder.new') : startNewFolder(placeNear(null))) },
  'manager': { text: () => t('menu_manager'), do: (m) => openManager(m.folderId) },
  'search': { text: () => COMMAND.search.title, command: 'search' },
  'palette': { text: () => COMMAND.palette.title, command: 'palette' },
  'settings': { text: () => COMMAND.settings.title, command: 'settings' },
  'undo': { text: () => (canUndo() ? t('undo_button_label', undoLabel()) : COMMAND.undo.title), command: 'undo' },
  'redo': { text: () => (canRedo() ? t('redo_label', redoLabel()) : COMMAND.redo.title), command: 'redo' },
};

// Почему пункт неактивен — текст подсказки по коду причины из menu-items.js
const REASONS = {
  system: () => t('locked_system_edit'),
  managed: () => t('locked_managed'),
  incognito: () => t('menu_incognito_off'),
  bookmarklet: () => t('menu_bookmarklet'),
  nothing: () => t('no_bookmarks_here'),
  clipboard: () => t('paste_empty'),
  inside: () => t('paste_inside'),
  one: () => t('menu_edit_single'),
  undo: () => t('undo_nothing'),
  redo: () => t('redo_nothing'),
};

const lockCode = (n) => (n.parentId === '0' ? 'system' : n.unmodifiable ? 'managed' : null);

// Вырезанная папка — та, куда вставляем, или её родитель?
function insideCut(parentId) {
  const ids = new Set(cutIds());
  for (let id = parentId; id; id = state.nodeById.get(id)?.parentId) if (ids.has(id)) return true;
  return false;
}

// Что можно в меню для what ('bookmark' | 'folder' | 'group' | 'empty') — см. menu-items.js
async function contextOf(what, node, nodes) {
  const place = placeNear(node);
  const [incognito, split] = await Promise.all([
    chrome.extension.isAllowedIncognitoAccess().catch(() => false),
    what === 'bookmark' ? canSplit().catch(() => false) : false,
  ]);
  const editable = nodes.filter(n => !isLocked(n));
  return {
    count: openableCount(nodes),
    bookmarklet: what === 'bookmark' && isBookmarklet(node.url),
    locked: nodes.length && !editable.length ? lockCode(nodes[0]) : null,
    place: placeLocked(place) ? 'managed' : null,
    clipboard: clipboardEmpty() ? 'empty' : clipboardMode(),
    inside: insideCut(place.parentId),
    split, incognito, undo: canUndo(), redo: canRedo(),
  };
}

let seq = 0;          // последнее открытие (меню собирается асинхронно — запоздалое не показываем)
let current = null;   // открытое меню: { what, node, nodes, ctx, folderId, entries }
let keyOpenedAt = 0;  // когда открыли с клавиатуры: следом браузер пришлёт своё contextmenu

// Открыть меню в точке (x, y): для строки node (what — её вид или 'group') или пустого места
async function openMenu(what, node, { x, y, keyboard = false }) {
  const my = ++seq;
  const nodes = what === 'empty' ? [] : targets();
  const ctx = await contextOf(what, node, nodes);
  if (my !== seq) return;
  const folderId = !node ? state.treeRoot?.id : node.url ? node.parentId : node.id;
  current = { what, node, nodes, ctx, folderId };
  current.entries = menuItems(what, ctx);
  render();
  menu.ariaLabel = node ? label(node) : t('panel_tree');
  menu.hidden = false;
  place(x, y);
  const first = menu.querySelector('[role="menuitem"]');
  (keyboard && first ? first : menu).focus();
}

function render() {
  const m = current;
  menu.replaceChildren(...m.entries.map((entry) => {
    const el = document.createElement('div');
    if (entry === '-') {
      el.role = 'separator';
      return el;
    }
    const item = ITEMS[entry.id];
    el.role = 'menuitem';
    el.tabIndex = -1;
    el.dataset.id = entry.id;
    el.append(Object.assign(document.createElement('span'), { className: 'label', textContent: item.text(m) }));
    if (entry.reason) {
      el.ariaDisabled = 'true';
      el.title = REASONS[entry.reason]();
    }
    const [key] = item.command ? keysOf(item.command) : [];
    if (key) {
      const keys = Object.assign(document.createElement('span'), { className: 'keys' });
      const binding = Object.assign(document.createElement('span'), { className: 'binding' });
      binding.append(...bindingNodes(key));
      keys.append(binding);
      el.append(keys);
    }
    return el;
  }));
}

// В пределах панели: открывается от точки вправо и вниз (справа налево — влево),
// а у края переворачивается
function place(x, y) {
  const margin = 4;
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const box = menu.getBoundingClientRect();
  let left = isRtl() ? x - box.width : x;
  if (left + box.width > width - margin) left = x - box.width;
  if (left < margin) left = isRtl() && x + box.width <= width - margin ? x : margin;
  let top = y;
  if (top + box.height > height - margin) top = y - box.height;
  top = Math.max(margin, Math.min(top, height - margin - box.height));
  menu.style.left = `${Math.max(margin, left)}px`;
  menu.style.top = `${top}px`;
}

function closeMenu(refocus = true) {
  if (menu.hidden) return;
  seq++;
  menu.hidden = true;
  current = null;
  if (refocus) focusHome();
}

function choose(el) {
  if (!el || el.ariaDisabled === 'true') return;
  const m = current;
  const item = ITEMS[el.dataset.id];
  closeMenu();
  item.do ? item.do(m) : run(item.command);
}

// Меню для строки i: если она отмечена вместе с другими — для всего отмеченного,
// иначе отметки снимаются и курсор встаёт на строку
function forRow(i) {
  const { node } = state.rows[i];
  const group = state.marked.has(node.id) && markedCount() > 1;
  if (!group && state.marked.size && !(state.marked.size === 1 && state.marked.has(node.id))) clearMarks();
  select(i, false);
  return [group ? 'group' : node.url ? 'bookmark' : 'folder', node];
}

// С клавиатуры — у строки под курсором (без строк — у начала списка)
export function openMenuAtCursor() {
  keyOpenedAt = Date.now();
  const li = list.children[state.sel];
  if (!state.rows.length || !li) {
    const box = list.getBoundingClientRect();
    return openMenu('empty', null, { x: isRtl() ? box.right - 16 : box.left + 16, y: box.top + 8, keyboard: true });
  }
  const [what, node] = forRow(state.sel);
  li.scrollIntoView({ block: 'nearest' });
  const box = li.getBoundingClientRect();
  openMenu(what, node, { x: isRtl() ? box.right - 24 : box.left + 24, y: box.bottom, keyboard: true });
}

function onContextMenu(e) {
  if (e.target.closest('input, textarea, dialog')) return; // в полях ввода — меню браузера (вставить текст)
  e.preventDefault();
  if (menu.contains(e.target) || Date.now() - keyOpenedAt < 600) return; // эхо клавиши меню
  const li = e.target.closest('#list li[data-i]');
  if (li) {
    const [what, node] = forRow(+li.dataset.i);
    return openMenu(what, node, { x: e.clientX, y: e.clientY });
  }
  if (state.marked.size) clearMarks();
  openMenu('empty', null, { x: e.clientX, y: e.clientY });
}

function onMenuKey(e) {
  e.stopPropagation(); // клавиши в меню не управляют списком
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  const at = items.indexOf(document.activeElement);
  const go = (i) => items[(i + items.length) % items.length]?.focus();
  switch (e.key) {
    case 'ArrowDown': go(at + 1); break;
    case 'ArrowUp': go(at < 0 ? -1 : at - 1); break;
    case 'Home': go(0); break;
    case 'End': go(-1); break;
    case 'Enter':
    case ' ':
      if (!e.repeat) choose(items[at]);
      break;
    case 'Escape':
    case 'Tab':
      closeMenu();
      break;
    default:
      return;
  }
  e.preventDefault();
}

let swallowClick = false; // клик мимо меню только закрывает его, строку под ним не открывает

export function listenMenu(runCommand) {
  run = runCommand;
  document.addEventListener('contextmenu', onContextMenu);
  menu.addEventListener('keydown', onMenuKey);
  menu.addEventListener('mousedown', (e) => e.preventDefault()); // фокус остаётся на пункте
  menu.addEventListener('mousemove', (e) => {
    const el = e.target.closest('[role="menuitem"]');
    if (el && el !== document.activeElement) el.focus();
  });
  menu.addEventListener('click', (e) => choose(e.target.closest('[role="menuitem"]')));
  document.addEventListener('mousedown', (e) => {
    swallowClick = false;
    if (menu.hidden || menu.contains(e.target)) return;
    closeMenu(e.button !== 2);
    if (e.button === 2) return; // правая кнопка мимо — меню откроется на новом месте
    swallowClick = true;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  for (const type of ['click', 'auxclick']) {
    document.addEventListener(type, (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }
  document.addEventListener('scroll', (e) => { if (e.target !== menu) closeMenu(false); }, true);
  window.addEventListener('resize', () => closeMenu(false));
  window.addEventListener('blur', () => closeMenu(false));
}
