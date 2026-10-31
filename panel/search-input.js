// Строка поиска: ввод запроса, клавиши в ней, открытие найденного.
import { chordOf } from '../commands.js';
import { t } from '../i18n.js';
import { list, live, searchInput } from './dom.js';
import { debounce } from './util.js';
import { state } from './state.js';
import { build, select } from './render.js';
import { leaveSearch, paintCount } from './find.js';
import { activate, askOpenSet } from './open.js';
import { runCommand } from './keys.js';

// Сколько нашлось — для экранного диктора, когда пользователь перестал печатать
const announce = debounce(() => {
  if (!state.search?.query) return;
  const total = state.rows.length + state.search.more;
  live.textContent = total ? t('search_found', total) : t('nothing_found');
}, 500);

// Открыть выбранное из поиска: закладку — как обычно, папку — показать в дереве
function openFromSearch({ flip = false, reset = false } = {}) {
  const node = state.rows[state.sel]?.node;
  if (!node) return;
  if (node.url) return activate({ flip, reset });
  if (flip) askOpenSet([node], node.title);
  else leaveSearch({ reveal: true, open: true });
}

// Команды, которые работают и из строки поиска, если их сочетание с ⌘/Ctrl или Alt
// (буквы и стрелки в строке нужны для ввода)
const SEARCH_COMMANDS = new Set(['search', 'palette', 'settings', 'panel.close',
  'open', 'open.alt', 'open.newTab', 'open.currentTab', 'open.group', 'open.reset']);

export function listenSearch() {
  searchInput.addEventListener('input', () => {
    if (!state.search) return;
    const query = searchInput.value.trim();
    if (query && !state.search.query) state.search.prevSelId = state.selId; // запоминаем место в дереве
    if (query) [state.selId, state.sel] = [null, 0];                        // новый запрос — с лучшего совпадения
    else if (state.search.query) state.selId = state.search.prevSelId;      // запрос стёрли — обратно к дереву
    state.search.query = query;
    build();
    paintCount();
    if (query) scrollTo(0, 0);
    else list.children[state.sel]?.scrollIntoView({ block: 'nearest' });
    announce();
  });

  searchInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // клавиши строки поиска не управляют списком
    if (e.isComposing || e.defaultPrevented) return; // удержанная клавиша, нажатая до перехода сюда
    const chord = chordOf(e);
    switch (chord) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        return select(state.sel + (chord === 'ArrowDown' ? 1 : -1));
      case 'Enter':
      case 'Mod+Enter':
      case 'Shift+Enter':
        e.preventDefault();
        if (!e.repeat) openFromSearch({ flip: chord === 'Mod+Enter', reset: chord === 'Shift+Enter' });
        return;
      case 'Escape':
        e.preventDefault();
        return leaveSearch();
      case 'Tab':
        e.preventDefault();
        return leaveSearch({ reveal: !!state.search?.query });
    }
    const id = state.bindings.get(chord);
    if (id && SEARCH_COMMANDS.has(id) && /^(Mod|Alt)\+/.test(chord)) {
      e.preventDefault();
      runCommand(id);
    }
  });
}
