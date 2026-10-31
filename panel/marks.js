// Отметки: отметить, снять, показать в полосе внизу панели.
import { t } from '../i18n.js';
import { list, marksBar } from './dom.js';
import { isLocked, lockedReason } from './nodes.js';
import { saveState, state } from './state.js';
import { markedCount } from './tree.js';
import { flash } from './ui.js';
import { keyText } from './keymap.js';

// Отмеченные строки — aria-selected (для экранного диктора это и есть «выбранные»),
// курсор — отдельно (aria-activedescendant и класс cur). Полоса «Выбрано» — только пока есть отметки
export function paintMarks() {
  state.rows.forEach(({ node }, i) => { list.children[i].ariaSelected = state.marked.has(node.id); });
  const count = state.marked.size && markedCount();
  const clear = keyText('mark.clear') || keyText('escape');
  marksBar.hidden = !count;
  marksBar.textContent = !count ? '' : clear ? t('marked_clear', count, clear) : t('marked', count);
}

export function setMark(node, on = !state.marked.has(node.id)) {
  if (isLocked(node)) return;
  on ? state.marked.add(node.id) : state.marked.delete(node.id);
  paintMarks();
  saveState();
}

// Отметка по действию пользователя (Пробел, Shift+клик): на заблокированном узле объясняем, почему
export function markOrExplain(node) {
  const reason = lockedReason(node);
  if (reason) flash(reason);
  else setMark(node);
}

export function clearMarks() {
  state.marked.clear();
  paintMarks();
  saveState();
}
