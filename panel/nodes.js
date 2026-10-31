// Узлы закладок (из chrome.bookmarks): название, блокировка, закладки внутри. Без DOM и состояния панели.
import { t } from '../i18n.js';
import { siteOf } from './url.js';

// Без названия — сайт закладки, а не её длинный адрес
export const label = (node) => node.title || (node.url ? siteOf(node.url) || node.url : t('untitled'));

// Корневые папки («Панель закладок» и т.п.) и управляемые закладки браузер менять не даёт
export const isLocked = (node) => node.parentId === '0' || node.unmodifiable;

// Закладки среди узлов и внутри папок — в порядке дерева
export function bookmarksIn(nodes, out = []) {
  for (const n of nodes) n.url ? out.push(n) : bookmarksIn(n.children ?? [], out);
  return out;
}

// Почему браузер не даёт отметить (action 'mark') или изменить (action 'edit') узел
// (системная папка или управляемая закладка), иначе null
export function lockedReason(node, action = 'mark') {
  if (node.parentId === '0') return t(action === 'edit' ? 'locked_system_edit' : 'locked_system_mark');
  if (node.unmodifiable) return t('locked_managed');
  return null;
}

// Причина для первого заблокированного из узлов — когда менять нечего; иначе null
export const firstLockedReason = (nodes, action) => nodes.map(n => lockedReason(n, action)).find(Boolean) ?? null;
