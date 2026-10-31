// Панель закладок: запуск.
import { SETTINGS_DEFAULTS, keymapOf } from '../commands.js';
import { localizePage, t } from '../i18n.js';
import { list, palette } from './dom.js';
import { ignore } from './util.js';
import { MARKS_SURVIVE, saveState, saved, state } from './state.js';
import { fetchTree, listenBookmarks, onTreeApplied } from './tree.js';
import { listenTabs, refreshTabs } from './tabs.js';
import { listenHistory } from './history.js';
import { listenClipboard } from './clipboard.js';
import { build, render } from './render.js';
import { paintMarks } from './marks.js';
import { listenGroupName } from './open.js';
import { listenEditDialog } from './edit.js';
import { flash, listenConfirm, listenFocus } from './ui.js';
import { actions, applyView, viewStored } from './actions.js';
import { listenMenu } from './context-menu.js';
import { keyText } from './keymap.js';
import { buildKeymap, listenKeys } from './keys.js';
import { listenPalette, renderPicker } from './palette.js';
import { listenMouse } from './mouse.js';
import { listenDrag } from './drag.js';
import { listenSearch } from './search-input.js';
import { connectBackground, tell } from './link.js';

// Порядок важен там, где на одно событие подписано несколько обработчиков
// (keydown документа в фазе перехвата, blur окна): они срабатывают в порядке подписки.
// Он тот же, что был в едином panel.js; сохранённое состояние уже прочитано (state.js).
localizePage();
listenSearch();
listenGroupName();
listenEditDialog();
listenConfirm();
listenFocus();
listenKeys();
buildKeymap(); // сразу работают умолчания; сохранённые сочетания подгрузятся при запуске
listenPalette();
listenMouse();
listenDrag();
listenMenu((id) => actions[id]?.());
connectBackground(); // узнаёт окно (state.winReady) — до чтения настроек ниже

onTreeApplied(() => {
  build();
  refreshTabs();
  if (palette.open && state.picker?.live) renderPicker({ keep: true }); // в выборе папки — свежие названия
});

chrome.storage.local.onChanged.addListener((c) => {
  for (const key in c) if (key in SETTINGS_DEFAULTS && key !== 'view') state.settings[key] = c[key].newValue ?? SETTINGS_DEFAULTS[key];
  if (c.keymap) { // подсказки и палитра — с новыми клавишами
    state.keymap = keymapOf(c.keymap.newValue);
    buildKeymap();
    state.rows.length ? paintMarks() : render();
    if (palette.open) renderPicker({ keep: true });
  }
  if (c.rootId) { state.selId = null; state.marked.clear(); saveState(); fetchTree(); }
  if (c.view) viewStored(c.view.newValue ?? SETTINGS_DEFAULTS.view, c.viewWrite?.newValue);
  if (c.recentFolders) state.recentFolders = Array.isArray(c.recentFolders.newValue) ? c.recentFolders.newValue : []; // из других окон
  if (c.pinnedTabs) refreshTabs();
});
listenBookmarks();
listenTabs();
listenHistory();
listenClipboard();

Promise.all([chrome.storage.local.get({ ...SETTINGS_DEFAULTS, keymap: {}, recentFolders: [] }), state.winReady])
  .then(([s]) => {
    ({ keymap: state.keymap, recentFolders: state.recentFolders, ...state.settings } = s);
    if (!Array.isArray(state.recentFolders)) state.recentFolders = [];
    state.keymap = keymapOf(state.keymap);
    buildKeymap();
    applyView();
    if (saved?.marked && saved.win === state.windowId && Date.now() - saved.at < MARKS_SURVIVE) state.marked = new Set(saved.marked);
    return fetchTree();
  })
  .then(async () => {
    if (document.activeElement === document.body) list.focus(); // успели открыть поиск — не отбираем
    list.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
    tell(document.hasFocus());
    // Один раз: после установки — подсказать, где меню и все команды; после обновления — что нового
    const { whatsNew, firstRun } = await chrome.storage.local.get(['whatsNew', 'firstRun']);
    const help = keyText('help');
    if (firstRun) {
      chrome.storage.local.remove('firstRun').catch(ignore);
      const commands = keyText('palette');
      flash([t('first_run_menu'), commands && t('first_run_commands', commands)].filter(Boolean).join(' · '), 6000);
    } else if (whatsNew) {
      chrome.storage.local.remove('whatsNew').catch(ignore);
      state.showNews = true;
      flash(t('updated', whatsNew) + (help ? ' ' + t('whats_new_key', help) : ''), 6000);
    }
  });
