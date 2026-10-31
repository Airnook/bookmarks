// Сочетания клавиш для подсказок и отмена начатой последовательности. Без DOM.
import { shortcutText } from '../commands.js';
import { state } from './state.js';

export const keysOf = (id) => state.resolved.get(id) ?? [];
export const keyText = (id) => { const key = keysOf(id)[0]; return key ? shortcutText(key) : ''; };

// Начатая последовательность клавиш (её ведёт keys.js) отменяется и снаружи, например при открытии выбора
export function cancelPending() {
  if (state.pending) clearTimeout(state.pending.timer);
  state.pending = null;
}
