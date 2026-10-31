// Мышь: клики по строкам (правая кнопка — меню, см. context-menu.js).
import { IS_MAC } from '../commands.js';
import { list } from './dom.js';
import { state } from './state.js';
import { closeTabs } from './tabs.js';
import { select } from './render.js';
import { markOrExplain } from './marks.js';
import { activate, askOpenSet } from './open.js';

// Клик — открыть, ⌘/Ctrl+клик — наоборот (новая/текущая вкладка), средняя кнопка —
// в новой вкладке, Shift+клик — отметить, крестик — закрыть вкладку.
// ⌘/Ctrl+клик и средняя кнопка по папке — открыть её закладки (можно группой).
// Второй клик двойного игнорируем, иначе папка раскроется и тут же свернётся.
function onRowClick(e) {
  const li = e.target.closest('li[data-i]');
  if (!li || e.button > 1 || e.detail > 1 || e.target.closest('.rename')) return;
  select(+li.dataset.i);
  const node = state.rows[state.sel].node;
  const mod = IS_MAC ? e.metaKey : e.ctrlKey || e.metaKey;
  if (e.target.closest('.close')) closeTabs([node]);
  else if (e.shiftKey) markOrExplain(node);
  else if (!node.url && (mod || e.button === 1)) askOpenSet([node], node.title);
  else activate({ flip: mod, middle: e.button === 1 });
  list.focus();
}

export function listenMouse() {
  list.addEventListener('click', onRowClick);
  list.addEventListener('auxclick', onRowClick);
  list.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // без автопрокрутки
}
