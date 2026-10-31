// Общие части интерфейса: окно подтверждения, сообщения, куда вернуть фокус.
import { confirmDialog, list, searchInput, toast } from './dom.js';
import { state } from './state.js';

export const isEditing = () => !!list.querySelector('.rename');
export const dialogOpen = () => !!document.querySelector('dialog[open]');

// Окно подтверждения. cancelFirst — по умолчанию (Enter) «Отмена».
// Возвращает обещание: true — подтвердили.
export function ask({ title: heading, text, ok, danger = false, cancelFirst = false }) {
  confirmDialog.querySelector('h2').textContent = heading;
  confirmDialog.querySelector('p').textContent = text;
  const okButton = confirmDialog.querySelector('[value=ok]');
  okButton.textContent = ok;
  okButton.className = danger ? 'danger' : 'primary';
  okButton.autofocus = !cancelFirst;
  confirmDialog.querySelector('[value=cancel]').autofocus = cancelFirst;
  confirmDialog.returnValue = '';
  confirmDialog.showModal();
  return new Promise((resolve) => {
    confirmDialog.onclose = () => {
      focusHome();
      resolve(confirmDialog.returnValue === 'ok');
    };
  });
}

// Куда вернуть фокус после окна: в строку поиска, если работали в ней, иначе в список
let home = list;

export const focusHome = () => (state.search && home === searchInput ? searchInput : list).focus();

// Короткое сообщение внизу панели. action — кнопка в нём: { text, label (для диктора), run }
let flashTimer;
export function flash(text, ms = 1600, action = null) {
  toast.textContent = text;
  if (action) {
    const button = Object.assign(document.createElement('button'), { textContent: action.text, tabIndex: -1 });
    button.ariaLabel = action.label;
    button.addEventListener('click', () => {
      toast.classList.remove('show');
      focusHome();
      action.run();
    });
    toast.replaceChildren(Object.assign(document.createElement('span'), { textContent: text }), button);
  }
  toast.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

export function listenConfirm() {
  // Пробел не нажимает кнопки подтверждения: текст, по ошибке набранный в панели
  // («d » — «в » на русской раскладке), не должен ничего удалить
  for (const type of ['keydown', 'keyup']) {
    confirmDialog.addEventListener(type, (e) => { if (e.key === ' ') e.preventDefault(); }, true);
  }
}

// Запоминать, где был фокус (для focusHome)
export function listenFocus() {
  list.addEventListener('focus', () => { home = list; });
  searchInput.addEventListener('focus', () => { home = searchInput; });
}
