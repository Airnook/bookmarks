// Кнопки «Отменить» и «Повторить» в шапке: те же команды, что и с клавиатуры.
// Недоступны, пока нечего отменять; подсказка и имя для дикторов — с сочетанием активного набора.
import { t } from '../i18n.js';
import { canRedo, canUndo, onHistoryChange } from './history.js';
import { withKey } from './keymap.js';

const buttons = [...document.querySelectorAll('#bar button')];

// Вызывается и при смене истории, и после смены клавиш
export function paintUndoButtons() {
  for (const b of buttons) {
    const id = b.dataset.cmd;
    b.disabled = !(id === 'undo' ? canUndo() : canRedo());
    b.title = b.ariaLabel = withKey(t('cmd_' + id), id);
  }
}

export function listenUndoButtons(run) {
  for (const b of buttons) b.addEventListener('click', () => run(b.dataset.cmd));
  onHistoryChange(paintUndoButtons);
  paintUndoButtons();
}
