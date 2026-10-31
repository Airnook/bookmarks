// Справка: подставляет в текст текущие клавиши (с учётом переназначений)
// и строит таблицу всех команд из того же реестра, что и панель.
// Тексты справки — сообщения help_* (data-i18n в help.html); клавиши вставляются на места
// вложенных элементов data-key / data-chord.
import { COMMANDS, COMMAND, MOD_LABELS, groupTitle, keymapOf, resolveKeymap, bindingNodes } from './commands.js';
import { localizePage, t } from './i18n.js';

localizePage();

const kbd = (text) => Object.assign(document.createElement('kbd'), { textContent: text });

function keyNodes(binding) {
  return binding === 'Mod' ? [kbd(MOD_LABELS.Mod)] : bindingNodes(binding);
}

// Команда без клавиш — подсказать, где её найти: в палитре, а саму палитру — в меню правой кнопкой
function viaPalette(id) {
  const text = id === 'palette' ? t('help_via_menu') : t('help_via_palette', COMMAND[id].title);
  return Object.assign(document.createElement('span'), { className: 'via', textContent: text });
}

function render(keymap) {
  const resolved = resolveKeymap(keymap);

  for (const el of document.querySelectorAll('[data-key]')) {
    const [first] = resolved.get(el.dataset.key) ?? [];
    el.className = 'keys';
    el.replaceChildren(...(first ? keyNodes(first) : [viaPalette(el.dataset.key)]));
  }
  for (const el of document.querySelectorAll('[data-chord]')) {
    el.className = 'keys';
    el.replaceChildren(...keyNodes(el.dataset.chord));
  }

  // все команды по группам
  const rows = [];
  let group = '';
  for (const c of COMMANDS) {
    if (c.group !== group) {
      group = c.group;
      const head = document.createElement('tr');
      head.append(Object.assign(document.createElement('th'), { colSpan: 2, textContent: groupTitle(group) }));
      rows.push(head);
    }
    const tr = document.createElement('tr');
    const name = Object.assign(document.createElement('td'), { textContent: c.title });
    if (c.note) name.append(Object.assign(document.createElement('span'), { className: 'via note-line', textContent: c.note }));
    const keys = Object.assign(document.createElement('td'), { className: 'keys' });
    const list = resolved.get(c.id);
    if (!list.length) {
      keys.append(Object.assign(document.createElement('span'), { className: 'via', textContent: c.id === 'palette' ? t('help_table_menu') : t('help_table_from_palette') }));
    }
    list.forEach((binding, i) => {
      const one = Object.assign(document.createElement('span'), { className: i ? 'alt' : '' });
      one.append(...keyNodes(binding));
      keys.append(one);
    });
    tr.append(name, keys);
    rows.push(tr);
  }
  const table = document.getElementById('keys-table');
  table.replaceChildren(...rows);
}

async function init() {
  document.getElementById('version').textContent = chrome.runtime.getManifest().version;
  const { keymap } = await chrome.storage.local.get('keymap');
  render(keymapOf(keymap));
  chrome.storage.local.remove('whatsNew'); // что нового — уже здесь

  const toggle = (await chrome.commands.getAll()).find(c => c.name === 'open-bookmarks');
  for (const el of document.querySelectorAll('[data-global]')) {
    el.className = 'keys';
    el.replaceChildren(toggle?.shortcut ? kbd(toggle.shortcut) : Object.assign(document.createElement('span'), {
      className: 'via', textContent: t('help_global_not_set'),
    }));
  }
}

for (const b of document.querySelectorAll('#open-settings, [data-settings]')) b.onclick = () => chrome.runtime.openOptionsPage();

// «Открыть панель»: боковую панель браузер открывает только прямо по нажатию —
// поэтому окно узнаём заранее
let windowId = null;
chrome.windows.getCurrent().then((w) => { windowId = w.id; });
document.getElementById('open-panel').onclick = () => {
  if (windowId !== null) chrome.sidePanel.open({ windowId }).catch(() => {});
};
document.getElementById('open-shortcuts').onclick = () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
chrome.storage.local.onChanged.addListener((c) => { if (c.keymap) render(keymapOf(c.keymap.newValue)); });

init();
