// Связь с фоновым скриптом: открыта ли панель и в фокусе ли, автоскрытие.
import { MODIFIER_KEYS } from '../commands.js';
import { ignore } from './util.js';
import { persist, state } from './state.js';
import { closePanel } from './open.js';

// Панель сообщает, открыта ли она и в фокусе ли: по этому фоновый скрипт решает,
// закрыть её или открыть. У каждой загрузки панели свой id, чтобы запоздалое
// «я закрылась» от старой панели не затёрло состояние новой.
const instance = crypto.randomUUID();

export function tell(focused, closed = false) {
  state.winReady
    .then(() => chrome.runtime.sendMessage({ type: 'panel-state', windowId: state.windowId, instance, focused, closed }))
    .catch(ignore);
}

// Соединение держит фоновый скрипт в курсе, что панель открыта. Если браузер
// его выгрузил, соединение рвётся — переподключаемся и напоминаем о себе.
function connect() {
  chrome.runtime.connect({ name: `panel:${state.windowId}:${instance}` })
    .onDisconnect.addListener(() => { void chrome.runtime.lastError; setTimeout(connect, 100); });
  tell(document.hasFocus());
}

// Автоскрытие: фокус ушёл на страницу или в интерфейс браузера → закрыться.
// Если окно браузера неактивно, это переключение в другое приложение — остаёмся.
async function hideIfFocusLeftToBrowser() {
  if (document.hasFocus()) return; // фокус уже вернулся (например, закрылось контекстное меню)
  if ((await chrome.windows.getCurrent()).focused) closePanel();
}

export function connectBackground() {
  state.winReady = chrome.windows.getCurrent().then((w) => { state.windowId = w.id; });

  state.winReady.then(connect);

  window.addEventListener('focus', () => tell(true));
  window.addEventListener('pagehide', () => { persist(); tell(false, true); });
  window.addEventListener('blur', () => {
    tell(false);
    if (state.settings.autoHide) setTimeout(hideIfFocusLeftToBrowser, 150);
  });

  // Запасной сигнал: клавиша сочетания (B) сюда не доходит, а модификатор,
  // нажатый перед ней, доходит — и напоминает «фокус во мне» прямо перед командой.
  document.addEventListener('keydown', (e) => {
    if (!e.repeat && MODIFIER_KEYS.has(e.key)) tell(true);
  }, true);

  // Вернулись в окно кликом по странице — панель без фокуса, тоже скрываем
  chrome.windows.onFocusChanged.addListener((id) => {
    if (state.settings.autoHide && id === state.windowId) setTimeout(hideIfFocusLeftToBrowser, 150);
  });
}
