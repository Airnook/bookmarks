// Отрисовка списка: строки дерева и найденного, курсор.
import { shortcutText } from '../commands.js';
import { t } from '../i18n.js';
import { list, searchInput } from './dom.js';
import { siteOf } from './url.js';
import { label } from './nodes.js';
import { highlightParts } from './search.js';
import { saveState, state } from './state.js';
import { folderSize } from './tree.js';
import { paintTabs } from './tabs.js';
import { findRows } from './search-index.js';
import { paintMarks } from './marks.js';
import { keyText } from './keymap.js';

// Текст с <mark> на совпадениях слов запроса
export const highlight = (text, words) => highlightParts(text, words)
  .map(([part, hit]) => (hit ? Object.assign(document.createElement('mark'), { textContent: part }) : part));

// Строки списка: дерево с раскрытыми папками или, пока идёт поиск, найденное
export function build() {
  if (state.search) state.search.more = 0;
  if (state.search?.query) {
    state.rows = findRows(state.search.query);
  } else {
    state.rows = [];
    (function walk(nodes, depth) {
      for (const node of nodes) {
        state.rows.push({ node, depth });
        if (node.children && state.expanded.has(node.id)) walk(node.children, depth + 1);
      }
    })(state.tree, 0);
  }
  render();
}

function note(text, className) {
  const li = Object.assign(document.createElement('li'), { className, textContent: text });
  li.role = 'none';
  return li;
}

function emptyText() {
  if (state.search?.query) return t('search_nothing', shortcutText('Escape'));
  const all = state.treeRoot?.id === '0';
  const folder = keyText('folder.new');
  return [
    all ? t('empty_all') : t('empty_folder'),
    all && t('empty_add_hint', shortcutText('Mod+d')),
    folder && t('empty_new_folder_hint', folder),
  ].filter(Boolean).join(' ');
}

export function render() {
  if (!state.rows.length) {
    list.replaceChildren(note(emptyText(), 'empty'));
    list.removeAttribute('aria-activedescendant');
    searchInput.removeAttribute('aria-activedescendant');
    paintMarks();
    return;
  }
  const frag = document.createDocumentFragment();
  state.rows.forEach((row, i) => frag.append(row.hit ? hitItem(row, i) : treeItem(row, i)));
  if (state.search?.more) frag.append(note(t('more_results', state.search.more), 'more'));
  list.replaceChildren(frag);
  paintTabs();
  paintMarks();

  // выбранной строки больше нет (удалили, переместили) — остаёмся на той же позиции;
  // прокрутку не трогаем, чтобы список не прыгал от фоновых изменений
  const i = state.rows.findIndex(r => r.node.id === state.selId);
  const scroll = i >= 0 && state.selId === state.scrollTarget; // переместили и перешли туда — показать
  if (scroll) state.scrollTarget = null;
  select(i >= 0 ? i : state.sel, scroll);
}

// Строка списка: иконка (фавиконка или папка); общая часть дерева и поиска
function rowItem(node, i, depth) {
  const li = document.createElement('li');
  li.id = 'row' + i;
  li.dataset.i = i;
  li.role = 'treeitem';
  li.ariaLevel = depth + 1;
  li.title = node.url ? `${label(node)}\n${node.url}` : label(node);
  li.style.setProperty('--depth', depth);
  let icon;
  if (node.url) {
    icon = new Image(16, 16); // 32px-иконка в 16px-рамке — чёткая на Retina
    icon.loading = 'lazy';
    icon.src = `/_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=32`;
  } else {
    li.className = 'folder';
    icon = document.createElement('i'); // иконка папки нарисована в CSS
  }
  li.append(icon);
  return li;
}

// Название и (в две строки) пояснение под ним
function twoLines(li, name, sub) {
  const lines = Object.assign(document.createElement('div'), { className: 'lines' });
  sub.className = 'sub';
  lines.append(name, sub);
  li.append(lines);
}

function treeItem({ node, depth }, i) {
  const li = rowItem(node, i, depth);
  if (!node.url) {
    li.ariaExpanded = state.expanded.has(node.id);
    if (!node.children.length) { li.classList.add('void'); li.dataset.empty = t('folder_empty'); }
  }
  const name = Object.assign(document.createElement('span'), { textContent: label(node) });
  if (state.settings.view !== 'detailed') {
    li.append(name);
    return li;
  }
  // вид «с адресом»: под названием сайт, у папки — сколько в ней закладок
  li.classList.add('two');
  // у закладки без названия название — уже сайт; ниже — адрес целиком
  const sub = !node.url ? folderSize(node) : node.title ? siteOf(node.url) : node.url;
  twoLines(li, name, Object.assign(document.createElement('span'), { textContent: sub }));
  return li;
}

// Найденное: название с подсветкой совпадений, под ним — сайт и папка
function hitItem({ node, hit }, i) {
  const li = rowItem(node, i, 0);
  li.classList.add('hit');
  const name = document.createElement('span');
  name.append(...highlight(label(node), hit.tokens));
  const sub = document.createElement('span');
  hit.where.forEach(([text, searchable], k) => {
    if (k) sub.append(' · ');
    sub.append(...(searchable ? highlight(text, hit.tokens) : [text]));
  });
  twoLines(li, name, sub);
  return li;
}

export function select(i, scroll = true) {
  if (!state.rows.length) return;
  state.sel = Math.max(0, Math.min(i, state.rows.length - 1));
  state.selId = state.rows[state.sel].node.id;
  list.querySelector('.cur')?.classList.remove('cur');
  const li = list.children[state.sel];
  li.classList.add('cur');
  list.setAttribute('aria-activedescendant', li.id);
  if (state.search) searchInput.setAttribute('aria-activedescendant', li.id);
  if (scroll) li.scrollIntoView({ block: 'nearest' });
  saveState();
}
