// Выбор из списка: палитра команд и папка для перемещения.
//
// Одно окно на два случая: палитра команд и «куда переместить». Источник
// по запросу отдаёт пункты { key, title, sub?, keys?, tokens?, folder?, create? }
// и заголовки разделов { section }; onPick получает выбранный пункт и { shift }.
import { COMMANDS, bindingNodes } from '../commands.js';
import { t } from '../i18n.js';
import { palette, paletteFoot, paletteHeading, paletteInput, paletteList } from './dom.js';
import { fuzzyScore } from './search.js';
import { state } from './state.js';
import { highlight } from './render.js';
import { dialogOpen, focusHome, isEditing } from './ui.js';
import { cancelPending, keysOf } from './keymap.js';

const MAX_PICKS = 150;

let paletteItems = [];  // пункты, которые можно выбрать (без заголовков разделов)
let paletteSel = 0;

// keep — список обновился сам (закладки поменялись): выделение остаётся на том же пункте
export function renderPicker({ keep = false } = {}) {
  if (!state.picker) return;
  const keepKey = keep ? paletteItems[paletteSel]?.key : undefined;
  const all = state.picker.source(paletteInput.value.trim());
  const shown = [];
  let more = 0;
  paletteItems = [];
  for (const item of all) {
    if (item.section) { shown.push(item); continue; }
    if (paletteItems.length >= MAX_PICKS && !item.create) { more++; continue; } // «Создать папку» — всегда видно
    paletteItems.push(item);
    shown.push(item);
  }
  paletteSel = Math.max(0, keepKey === undefined ? 0 : paletteItems.findIndex(i => i.key === keepKey));
  if (!paletteItems.length) {
    paletteList.replaceChildren(Object.assign(document.createElement('li'), { className: 'none', textContent: t('nothing_found'), role: 'none' }));
    paletteInput.removeAttribute('aria-activedescendant');
    return;
  }
  let n = 0;
  const lis = shown.map((item) => {
    const li = document.createElement('li');
    if (item.section) {
      li.className = 'section';
      li.role = 'presentation';
      li.textContent = item.section;
      return li;
    }
    const i = n++;
    li.id = 'pick' + i;
    li.dataset.i = i;
    li.role = 'option';
    if (item.folder) li.append(document.createElement('i'));
    if (item.create) li.append(Object.assign(document.createElement('span'), { className: 'plus', textContent: '+' }));
    const text = Object.assign(document.createElement('span'), { className: 'pick-text' });
    const name = document.createElement('span');
    name.append(...(item.tokens ? highlight(item.title, item.tokens) : [item.title]));
    text.append(name);
    if (item.sub) {
      const sub = Object.assign(document.createElement('span'), { className: 'pick-sub' });
      sub.append(...(item.tokens ? highlight(item.sub, item.tokens) : [item.sub]));
      text.append(sub);
    }
    li.append(text);
    if (item.keys?.length) {
      const keys = Object.assign(document.createElement('span'), { className: 'keys' });
      for (const binding of item.keys) {
        const one = Object.assign(document.createElement('span'), { className: 'binding' });
        one.append(...bindingNodes(binding));
        keys.append(one);
      }
      li.append(keys);
    }
    return li;
  });
  if (more) lis.push(Object.assign(document.createElement('li'), { className: 'none', textContent: t('more_results', more), role: 'none' }));
  paletteList.replaceChildren(...lis);
  paintPalette();
}

function paintPalette() {
  paletteList.querySelector('[aria-selected]')?.removeAttribute('aria-selected');
  const li = document.getElementById('pick' + paletteSel);
  if (!li) return;
  li.ariaSelected = true;
  paletteInput.setAttribute('aria-activedescendant', li.id);
  li.scrollIntoView({ block: 'nearest' });
}

export function openPicker(spec) {
  cancelPending();
  state.picker = spec;
  paletteItems = [];
  paletteInput.value = '';
  paletteInput.placeholder = spec.placeholder;
  paletteHeading.textContent = spec.heading ?? '';
  paletteHeading.hidden = !spec.heading;
  paletteFoot.textContent = spec.foot ?? '';
  if (spec.heading) paletteInput.setAttribute('aria-describedby', 'palette-heading');
  else paletteInput.removeAttribute('aria-describedby');
  paletteInput.ariaLabel = spec.label;
  palette.ariaLabel = spec.label;
  paletteList.ariaLabel = spec.label;
  renderPicker();
  palette.showModal();
  paletteInput.focus();
}

function pick(i, shift = false) {
  const item = paletteItems[i];
  if (!item || !state.picker) return;
  const { onPick } = state.picker;
  palette.close();
  focusHome(); // открыли из строки поиска — туда и вернёмся
  onPick(item, { shift });
}

// Палитра: все команды, кроме самой палитры, с их клавишами. Без запроса —
// сначала то, что чаще ищут в палитре (правка, открытие), навигация — в конце.
// run(id) выполняет выбранную команду: палитра не знает, где команды лежат.
const PALETTE_ORDER = ['edit', 'open', 'marks', 'panel', 'nav'];
export function openPalette(run) {
  openPicker({
    label: t('cmd_palette'),
    placeholder: t('palette_placeholder'),
    source: (query) => COMMANDS
      .filter(c => c.id !== 'palette')
      .map((c, order) => ({ c, order, group: PALETTE_ORDER.indexOf(c.group), score: fuzzyScore(query.toLowerCase(), `${c.title} ${c.note ?? ''} ${c.words}`.toLowerCase()) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.group - b.group || a.order - b.order)
      .map(({ c }) => ({ key: c.id, id: c.id, title: c.title, sub: c.note, keys: keysOf(c.id) })),
    onPick: (item) => run(item.id),
  });
}

export function listenPalette() {
  paletteInput.addEventListener('input', () => renderPicker());
  paletteInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // клавиши в поле палитры не управляют списком
    if (e.isComposing || e.defaultPrevented) return;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && paletteItems.length) {
      e.preventDefault();
      paletteSel = (paletteSel + (e.key === 'ArrowDown' ? 1 : -1) + paletteItems.length) % paletteItems.length;
      paintPalette();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) pick(paletteSel, e.shiftKey);
    }
  });
  // мышь: наведение двигает выделение, клик выполняет; фокус остаётся в поле ввода
  paletteList.addEventListener('mousemove', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li && +li.dataset.i !== paletteSel) { paletteSel = +li.dataset.i; paintPalette(); }
  });
  paletteList.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) pick(+li.dataset.i, e.shiftKey);
  });
  palette.addEventListener('mousedown', (e) => { if (e.target !== paletteInput) e.preventDefault(); });
  palette.addEventListener('close', () => {
    if (palette.open) return; // из палитры сразу открыли выбор папки — это уже новый выбор
    state.picker = null;
    if (!dialogOpen() && !isEditing()) focusHome();
  });
}
