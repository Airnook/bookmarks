import {
  COMMANDS, COMMAND, PRESETS, SETTINGS_DEFAULTS, DOUBLE_WAIT, SEQUENCE_WAIT,
  groupTitle, cleanHotkeys, keymapOf, storedKeymap, bindingsOf, isReserved, resolveKeymap, chordOf, physicalChordOf, preferPhysical, shortcutText, bindingNodes,
} from './commands.js';
import { localizePage, t } from './i18n.js';
import { envelope, readSettingsFile } from './settings-file.js';
import { THEME_BASE, cleanTheme } from './theme.js';

localizePage();

const select = document.getElementById('root');
const viewSelect = document.getElementById('view');
const switches = ['newTab', 'pinnedTabs', 'autoHide'].map(id => document.getElementById(id));
const keymapBox = document.getElementById('keymap');
const status = document.getElementById('status');

let keymap = {};      // изменённые сочетания: id команды → список
let preset = 'default'; // последний выбранный набор: к его клавишам возвращает «сбросить»
let globalKey = '';   // сочетание открытия панели — его задают в настройках Chrome
let recording = null; // { id, parts, at, timer } — идёт запись сочетания

function notify(text) {
  status.textContent = text;
  status.classList.add('show');
  clearTimeout(notify.t);
  notify.t = setTimeout(() => status.classList.remove('show'), 2600);
}

async function save(data, text = t('options_saved')) {
  await chrome.storage.local.set(data);
  notify(text);
}

// ---------- общие настройки ----------

// Выбранная стартовая папка. Хранится как в хранилище, даже если папку уже удалили:
// тогда список показывает «Все закладки», но хранилище не трогаем.
let rootId = SETTINGS_DEFAULTS.rootId;

// Список папок для выбора стартовой; выбор — rootId
function buildRoots(tree) {
  const options = [new Option(t('all_bookmarks'), '')];
  (function walk(nodes, depth) {
    for (const node of nodes) {
      if (node.url) continue;
      const indent = '   '.repeat(depth);
      options.push(new Option(indent + (node.title || t('untitled')), node.id));
      walk(node.children, depth + 1);
    }
  })(tree.children, 0);

  select.replaceChildren(...options);
  showRoot();
}

function showRoot() {
  select.value = rootId;
  if (select.value !== rootId) select.value = ''; // папку удалили
}

// Пачка событий закладок (перенос папок) даёт одну перестройку списка
const ROOTS_DELAY = 300;
let rootsTimer = null;
// Во время импорта — сотни событий: одна перестройка, когда импорт закончился
let importing = false;
// Пока открыт выпадающий список папок, его не перестраиваем (он закрылся бы): перестроим на blur/change
let rootsPending = false;

async function refreshRoots(force = false) {
  if (!force && document.activeElement === select) { rootsPending = true; return; }
  rootsPending = false;
  const [tree] = await chrome.bookmarks.getTree();
  buildRoots(tree);
}

function flushRoots() {
  if (rootsPending) refreshRoots(true).catch(console.error);
}

function scheduleRoots() {
  if (importing) return;
  clearTimeout(rootsTimer);
  rootsTimer = setTimeout(() => refreshRoots().catch(console.error), ROOTS_DELAY);
}

async function init() {
  const [tree] = await chrome.bookmarks.getTree();
  const saved = await chrome.storage.local.get({ ...SETTINGS_DEFAULTS, keymap: null, preset, theme: null });

  rootId = saved.rootId;
  buildRoots(tree);

  for (const s of switches) s.checked = saved[s.id];
  viewSelect.value = saved.view;
  if (viewSelect.value !== saved.view) viewSelect.value = SETTINGS_DEFAULTS.view;
  theme = cleanTheme(saved.theme);
  showTheme();
  keymap = storedKeymap(saved.keymap);
  preset = saved.preset;
  const toggle = (await chrome.commands.getAll()).find(c => c.name === 'open-bookmarks');
  globalKey = toggle?.shortcut || t('options_global_not_set');
  renderKeymap();
}

select.onchange = () => {
  rootId = select.value;
  save({ rootId });
  flushRoots();
};
select.addEventListener('blur', flushRoots);
viewSelect.onchange = () => save({ view: viewSelect.value });
document.getElementById('help').onclick = () => chrome.tabs.create({ url: 'help.html' });
for (const s of switches) s.onchange = () => save({ [s.id]: s.checked });

// ---------- оформление панели ----------
// Источник — theme (как в хранилище); каждое изменение сразу сохраняется, открытая панель
// подхватывает его из onChanged.

let theme = cleanTheme();
const field = (id) => document.getElementById(`theme-${id}`);
// поля цвета: [тема, цвет, поле, «сбросить»]
const colorFields = ['light', 'dark'].flatMap(m => ['background', 'text', 'accent'].map(k => [m, k, field(`${m}-${k}`), field(`${m}-${k}-reset`)]));
// что показать в поле цвета, пока цвет не задан: Canvas Chrome в светлой и тёмной теме
const CANVAS = { light: '#ffffff', dark: '#121212' };
const shownColor = (m, k) => theme.colors[m][k] || (k === 'background' ? CANVAS[m] : THEME_BASE[m][k]);
// внешний адрес в своём CSS: url(https://…), url(//…), @import
const EXTERNAL = /url\(\s*['"]?\s*(https?:)?\/\/|@import/i;

function showTheme() {
  field('mode').value = theme.mode;
  for (const [mode, key, input, reset] of colorFields) {
    input.value = shownColor(mode, key);
    reset.disabled = !theme.colors[mode][key];
  }
  field('font').value = theme.font;
  const browser = theme.fontSize === 'browser';
  field('size-browser').checked = browser;
  field('size').disabled = browser;
  field('size').value = browser ? '' : theme.fontSize;
  const full = theme.radius === 'full';
  field('radius-full').checked = full;
  field('radius').disabled = full;
  field('radius').value = full ? '' : theme.radius;
  field('favicons').checked = theme.favicons;
  field('counts').checked = theme.folderCounts;
  field('guides').checked = theme.indentGuides;
  field('css-on').checked = theme.customCssOn;
  field('css').value = theme.customCss;
  field('css-warning').hidden = !EXTERNAL.test(theme.customCss);
}

// Поменять тему (change меняет theme), сохранить и показать уже проверенное значение
function setTheme(change) {
  change();
  theme = cleanTheme(theme);
  showTheme();
  save({ theme });
}

field('mode').onchange = () => setTheme(() => { theme.mode = field('mode').value; });
for (const [mode, key, input, reset] of colorFields) {
  input.onchange = () => setTheme(() => { theme.colors[mode][key] = input.value; });
  reset.onclick = () => setTheme(() => { theme.colors[mode][key] = ''; });
}
field('font').onchange = () => setTheme(() => { theme.font = field('font').value; });
// пустое или не число — прежнее значение (cleanTheme)
field('size').onchange = () => setTheme(() => { theme.fontSize = parseFloat(field('size').value); });
field('size-browser').onchange = () => setTheme(() => { theme.fontSize = field('size-browser').checked ? 'browser' : NaN; });
field('radius').onchange = () => setTheme(() => { theme.radius = parseFloat(field('radius').value); });
field('radius-full').onchange = () => setTheme(() => { theme.radius = field('radius-full').checked ? 'full' : NaN; });
field('favicons').onchange = () => setTheme(() => { theme.favicons = field('favicons').checked; });
field('counts').onchange = () => setTheme(() => { theme.folderCounts = field('counts').checked; });
field('guides').onchange = () => setTheme(() => { theme.indentGuides = field('guides').checked; });
field('css-on').onchange = () => setTheme(() => { theme.customCssOn = field('css-on').checked; });
field('css').onchange = () => setTheme(() => { theme.customCss = field('css').value; });
field('css').oninput = () => { field('css-warning').hidden = !EXTERNAL.test(field('css').value); };
field('reset').onclick = () => setTheme(() => { theme = cleanTheme(); });

// ---------- список команд ----------

function button(className, text, title, onclick) {
  const b = document.createElement('button');
  b.className = className;
  b.textContent = text;
  if (title) { b.title = title; b.ariaLabel = title; }
  b.onclick = onclick;
  return b;
}

// Пока нажата кнопка мыши, список не перерисовываем: кнопка под курсором
// заменилась бы новой, и клик потерялся бы. Перерисуем сразу после клика.
let mouseDown = false;
let deferred = null; // { focusId } — отложенная перерисовка

function rerender(focusId) {
  if (!mouseDown) return renderKeymap(focusId);
  deferred = { focusId };
  clearTimeout(rerender.t);
  rerender.t = setTimeout(flushRender, 1000); // на случай, если mouseup так и не придёт
}

function flushRender() {
  clearTimeout(rerender.t);
  mouseDown = false;
  if (!deferred) return;
  const { focusId } = deferred;
  deferred = null;
  renderKeymap(focusId);
}

// focusId — после перерисовки вернуть фокус на «+» этой команды;
// по умолчанию — той, где фокус был до перерисовки
function renderKeymap(focusId) {
  const shown = resolveKeymap(keymap);
  const viewKey = shown.get('view.cycle')[0];
  document.getElementById('view-key').textContent = viewKey ? shortcutText(viewKey) : t('options_from_palette');
  focusId ??= keymapBox.contains(document.activeElement) ? document.activeElement.closest('.cmd')?.dataset.id : undefined;
  // открытие панели — команда Chrome: здесь только показываем и ведём в его настройки
  const global = document.createElement('div');
  global.className = 'cmd cmd-global';
  const globalKeys = Object.assign(document.createElement('span'), { className: 'cmd-keys' });
  globalKeys.append(Object.assign(document.createElement('span'), { className: 'chip', textContent: globalKey }),
    button('link', t('options_global_change'), '', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })));
  global.append(Object.assign(document.createElement('span'), { className: 'cmd-title', textContent: t('options_global_title') }), globalKeys);
  const out = [global];
  let group = '';
  for (const c of COMMANDS) {
    if (c.group !== group) {
      group = c.group;
      out.push(Object.assign(document.createElement('h3'), { textContent: groupTitle(group) }));
    }
    const row = document.createElement('div');
    row.className = 'cmd';
    row.dataset.id = c.id;
    const name = Object.assign(document.createElement('span'), { className: 'cmd-title', textContent: c.title });
    if (c.note) name.append(Object.assign(document.createElement('span'), { className: 'cmd-note', textContent: c.note }));
    const keys = Object.assign(document.createElement('span'), { className: 'cmd-keys' });

    const list = shown.get(c.id);
    for (const binding of list) {
      const chip = Object.assign(document.createElement('span'), { className: 'chip' });
      chip.append(...bindingNodes(binding), button('chip-x', '×', t('options_remove_binding', shortcutText(binding), c.title), () => {
        assign(c.id, own => own.filter(b => b !== binding));
      }));
      keys.append(chip);
    }
    if (!list.length && recording?.id !== c.id) {
      keys.append(Object.assign(document.createElement('span'), {
        className: 'none', textContent: c.id === 'palette' ? t('options_only_button') : t('options_only_palette'),
      }));
    }
    if (recording?.id === c.id) {
      // запись: нажатое, а если сочетание занято — вопрос, забрать ли его
      const rec = Object.assign(document.createElement('span'), { className: 'chip recording', tabIndex: -1 });
      rec.role = 'status';
      const { parts, taken } = recording;
      const owner = taken?.owner ?? (parts.length ? ownerOf(parts.join(' '), c.id) : null);
      if (parts.length || taken) rec.append(...bindingNodes(taken?.binding ?? parts.join(' ')));
      else rec.textContent = t('options_press_keys');
      if (owner) rec.append(' ' + t('options_taken', COMMAND[owner].title));
      keys.append(rec);
    } else {
      keys.append(button('add', '+', t('options_add_binding', c.title), () => startRecording(c.id)));
    }
    if (!sameSet(bindingsOf(c.id, keymap), presetKeys(c.id))) {
      keys.append(button('reset', t('options_reset'), t('options_reset_title', c.title), () => assign(c.id, () => presetKeys(c.id))));
    }

    row.append(name, keys);
    out.push(row);
  }
  keymapBox.replaceChildren(...out);
  paintPresets();
  if (recording) keymapBox.querySelector('.recording')?.focus(); // диктор прочтёт, что ждём сочетание
  else if (focusId) keymapBox.querySelector(`[data-id="${focusId}"] .add`)?.focus();
}

// Какой набор сейчас: кнопка нажата, если сочетания в точности как в наборе
const canonical = (km) => JSON.stringify(Object.entries(keymapOf(km))
  .map(([id, keys]) => [id, Array.isArray(keys) ? [...keys].sort() : keys])
  .sort(([a], [b]) => (a < b ? -1 : 1)));
function paintPresets() {
  const current = canonical(keymap);
  let match = null;
  for (const b of document.querySelectorAll('[data-preset]')) {
    const on = canonical(PRESETS[b.dataset.preset]) === current;
    b.classList.toggle('on', on);
    b.ariaPressed = on;
    if (on) match = b.textContent;
  }
  document.getElementById('preset-state').textContent = match ? '' : t('options_custom');
}

// Клавиши команды в последнем выбранном наборе
const presetKeys = (id) => (PRESETS[preset] ?? PRESETS.default)[id] ?? COMMAND[id].keys;
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// Изменения выполняются по очереди, и каждое берёт свежие настройки: два быстрых
// изменения (или вторая вкладка настроек) не затрут друг друга.
let queue = Promise.resolve();
const serial = (job) => (queue = queue.then(job).catch(console.error));

// Изменить сочетания команды: change(текущие) → новые. Сочетание может принадлежать
// только одной команде — с других его снимаем. Совпадающее с умолчанием храним
// как «не менялось». note(keymap) — дополнительная пометка к сообщению.
function assign(id, change, note) {
  return serial(async () => {
    keymap = storedKeymap((await chrome.storage.local.get({ keymap: null })).keymap);
    const current = resolveKeymap(keymap);
    const list = change(current.get(id));
    const notes = [];
    for (const c of COMMANDS) {
      if (c.id === id) continue;
      const own = current.get(c.id);
      const rest = own.filter(b => !list.includes(b));
      if (rest.length === own.length) continue;
      if (sameSet(rest, c.keys)) delete keymap[c.id]; else keymap[c.id] = rest;
      notes.push(t('options_removed_from', c.title));
    }
    if (sameSet(list, COMMAND[id].keys)) delete keymap[id]; else keymap[id] = list;
    const extra = note?.(keymap);
    if (extra) notes.push(extra);
    if (!resolveKeymap(keymap).get('palette').length) notes.push(t('options_palette_button_only'));
    await save({ keymap }, notes.length ? t('options_saved_notes', notes.join('; ')) : t('options_saved'));
    rerender(id);
  });
}

// ---------- запись сочетания ----------

function startRecording(id) {
  stopRecording();
  recording = { id, parts: [], at: 0, timer: null };
  rerender();
}

function stopRecording() {
  if (recording) clearTimeout(recording.timer);
  recording = null;
}

// Клавиши ловим раньше всех, пока идёт запись. Esc — отмена, Enter после клавиши —
// «готово». Вторая клавиша, нажатая быстро, делает последовательность (G G) или
// двойное нажатие (Enter Enter) — в том же темпе, в каком панель их потом распознает.
document.addEventListener('keydown', (e) => {
  if (!recording) return;
  // записываем так же, как панель потом поймёт: знаки нелатинской раскладки — по месту клавиши
  const chord = (preferPhysical(e) && physicalChordOf(e)) || chordOf(e);
  if (!chord) return; // ждём основную клавишу после модификаторов
  e.preventDefault();
  e.stopPropagation();
  if (e.repeat) return;
  // такое сочетание до панели не дойдёт; запись продолжается
  if (isReserved(chord)) return notify(t('options_reserved', shortcutText(chord)));
  const id = recording.id;
  if (recording.taken) { // ответ на «уже занято»
    if (chord === 'Enter') return commitRecording(true);
    stopRecording();
    if (chord !== 'Escape') { // другая клавиша — с неё и пишем заново
      startRecording(id);
      Object.assign(recording, { parts: [chord], at: performance.now(), timer: setTimeout(commitRecording, SEQUENCE_WAIT) });
    }
    return rerender(id);
  }
  if (chord === 'Escape') { stopRecording(); rerender(id); return; }

  const now = performance.now();
  const [first] = recording.parts;
  // Enter после клавиши — «готово» (а если она занята — «забрать»); Enter после
  // свободного Enter — двойное нажатие
  if (first && chord === 'Enter' && (first !== 'Enter' || ownerOf(recording.parts.join(' '), id))) return commitRecording(true);
  if (first && chord === first && now - recording.at > repeatWait(first)) {
    commitRecording(); // для двойного нажатия слишком медленно — записываем одиночное
    return;
  }
  recording.parts.push(chord);
  recording.at = now;
  clearTimeout(recording.timer);
  rerender();
  if (recording.parts.length >= 2) commitRecording();
  else recording.timer = setTimeout(commitRecording, SEQUENCE_WAIT);
}, true);

// У какой другой команды уже есть это сочетание
const ownerOf = (binding, id) => [...resolveKeymap(keymap)].find(([other, keys]) => other !== id && keys.includes(binding))?.[0] ?? null;

// Сколько панель ждёт второго нажатия той же клавиши: если у одиночного нажатия
// есть своё действие — недолго (двойное нажатие), иначе — как продолжения последовательности
const repeatWait = (chord) => ([...resolveKeymap(keymap).values()].flat().includes(chord) ? DOUBLE_WAIT : SEQUENCE_WAIT);

// Клик мимо записи завершает её: уже нажатое сохраняем, пустую (и вопрос «забрать?») — отменяем
document.addEventListener('mousedown', (e) => {
  mouseDown = true;
  if (!recording || e.target.closest('.recording')) return;
  if (recording.parts.length && !recording.taken) commitRecording();
  else { stopRecording(); rerender(); }
}, true);
document.addEventListener('mouseup', () => setTimeout(flushRender), true); // уже после click
window.addEventListener('blur', flushRender);

// confirmed — пользователь согласился забрать сочетание у другой команды
function commitRecording(confirmed = false) {
  if (!recording) return;
  const { id, parts } = recording;
  if (!parts.length) { stopRecording(); return rerender(id); }
  const binding = parts.join(' ');
  const owner = ownerOf(binding, id);
  if (owner && !confirmed) {
    clearTimeout(recording.timer);
    recording.taken = { binding, owner };
    return rerender();
  }
  stopRecording();
  assign(id, own => (own.includes(binding) ? own : [...own, binding]), (km) => {
    // одиночное нажатие, которое начинает последовательность, срабатывает с задержкой
    const all = [...resolveKeymap(km).values()].flat();
    const delayed = all.some(b => b !== binding && (b.startsWith(binding + ' ') || binding.startsWith(b + ' ')));
    return delayed ? t('options_delayed') : '';
  });
}

// ---------- наборы ----------

// Окно замены набора (вместо confirm(): его кнопки на языке браузера). Enter — заменить,
// Esc — отмена; фокус — обратно на кнопку набора
const presetDialog = document.getElementById('preset-dialog');
function askReplace(button, name = button.textContent) {
  document.getElementById('preset-title').textContent = t('options_replace_preset', name);
  presetDialog.returnValue = '';
  presetDialog.showModal();
  presetDialog.querySelector('[value=ok]').focus();
  return new Promise((resolve) => {
    presetDialog.onclose = () => {
      button.focus();
      resolve(presetDialog.returnValue === 'ok');
    };
  });
}

for (const b of document.querySelectorAll('[data-preset]')) {
  b.onclick = async () => {
    stopRecording();
    if (b.classList.contains('on')) return rerender(); // уже он
    // свои сочетания (не совпадают ни с одним набором) пропадут — спросить
    const custom = Object.values(PRESETS).every(p => canonical(p) !== canonical(keymap));
    if (custom && !(await askReplace(b))) return rerender();
    serial(async () => {
      keymap = structuredClone(PRESETS[b.dataset.preset]);
      preset = b.dataset.preset;
      await save({ keymap, preset }, t('options_preset_applied', b.textContent));
      rerender();
    });
  };
}

// ---------- файл с клавишами ----------

const HOTKEYS_FORMAT = 1;
const HOTKEYS_FILE = 'bookmarks-hotkeys.json';
const IMPORT_ERRORS = { broken: 'options_import_broken', wrong_type: 'options_import_wrong_type', newer: 'options_import_newer' };
const importFile = document.getElementById('import-file');

document.getElementById('export').onclick = () => {
  const file = envelope('hotkeys', HOTKEYS_FORMAT, { preset, keymap }, chrome.runtime.getManifest().version);
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })),
    download: HOTKEYS_FILE,
  });
  a.click();
  URL.revokeObjectURL(a.href);
};

document.getElementById('import').onclick = () => importFile.click();

importFile.onchange = async () => {
  const [file] = importFile.files;
  importFile.value = ''; // тот же файл можно выбрать снова
  if (!file) return;
  stopRecording();
  const read = readSettingsFile(await file.text(), 'hotkeys', HOTKEYS_FORMAT);
  const clean = read.data && cleanHotkeys(read.data);
  if (!clean) return notify(t(IMPORT_ERRORS[read.error ?? 'broken']));
  if (!(await askReplace(document.getElementById('import'), file.name))) return rerender();
  serial(async () => {
    ({ keymap, preset } = clean);
    await save({ keymap, preset }, clean.dropped ? t('options_imported_skipped', String(clean.dropped)) : t('options_imported'));
    rerender();
  });
};

// изменения из другой вкладки настроек или из панели (вид переключают клавишей)
// Только отражаем: записи в хранилище здесь не делаем
chrome.storage.local.onChanged.addListener((c) => {
  if (c.preset) preset = c.preset.newValue ?? 'default';
  if ((c.keymap || c.preset) && !recording) { if (c.keymap) keymap = storedKeymap(c.keymap.newValue); rerender(); }
  if (c.view) viewSelect.value = c.view.newValue ?? SETTINGS_DEFAULTS.view;
  if (c.rootId) { rootId = c.rootId.newValue ?? SETTINGS_DEFAULTS.rootId; showRoot(); }
  for (const s of switches) if (Object.hasOwn(c, s.id)) s.checked = c[s.id].newValue ?? SETTINGS_DEFAULTS[s.id];
  if (c.theme) { theme = cleanTheme(c.theme.newValue); showTheme(); }
});

for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered']) {
  chrome.bookmarks[ev].addListener(scheduleRoots);
}
chrome.bookmarks.onImportBegan.addListener(() => { importing = true; clearTimeout(rootsTimer); });
chrome.bookmarks.onImportEnded.addListener(() => { importing = false; scheduleRoots(); });

init();
