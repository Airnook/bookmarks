// Режим поиска: строка поиска сверху (её видно только во время поиска), вход в него и выход.
import { t } from '../i18n.js';
import { list, live, searchBar, searchCount, searchInput } from './dom.js';
import { saveState, state } from './state.js';
import { reveal } from './tree.js';
import { build, select } from './render.js';


// Видимое число найденного в строке поиска — сразу, без задержки; диктору его сообщает #live.
// Пустой запрос и «ничего не найдено» — без текста: при «ничего» список сам пишет об этом
// (иначе счётчик повторял бы строку списка и не влезал в узкое поле)
export function paintCount() {
  const total = state.search?.query ? state.rows.length + state.search.more : 0;
  searchCount.textContent = total ? t('search_found', total) : '';
}

// Открыть строку поиска (или вернуться в неё)
export function startSearch() {
  if (!state.search) {
    state.search = { query: '', prevSelId: state.selId, more: 0 };
    searchBar.hidden = false;
  }
  searchInput.focus();
  searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
}

// Выйти из поиска. reveal — показать выбранное на его месте в дереве (раскрыв папки
// вокруг него; open — и саму папку); иначе курсор вернётся туда, где был до поиска.
export function leaveSearch({ reveal: show = false, open = false } = {}) {
  if (!state.search) return;
  const target = (show || !state.search.query ? state.selId : null) ?? state.search.prevSelId;
  state.search = null;
  state.searchIndex = null; // понадобится снова — построим; пока не держим в памяти
  searchInput.value = '';
  searchInput.removeAttribute('aria-activedescendant');
  searchBar.hidden = true;
  paintCount();
  live.textContent = '';
  if (show && target) {
    reveal(state.nodeById.get(target)?.parentId);
    if (open && !state.nodeById.get(target)?.url) state.expanded.add(target);
    saveState();
  }
  state.selId = target;
  build();
  list.focus();
  select(state.sel);
}
