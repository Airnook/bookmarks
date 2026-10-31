// Что можно найти: индекс закладок и папок и найденные строки. Без DOM.
import { splitUrl } from './url.js';
import { label } from './nodes.js';
import { fold, rank } from './search.js';
import { state } from './state.js';
import { folderSize } from './tree.js';

const MAX_HITS = 100;

// Всё, что можно найти: закладки и папки внутри стартовой папки, с путём к ним,
// папка — перед своим содержимым. «Панель закладок» в пути не пишем — там лежит почти всё.
// foldersOnly — для выбора папки: без закладок, а значит без разбора адресов.
function buildIndex(foldersOnly) {
  const out = [];
  (function walk(nodes, trail) {
    const pathText = trail.join(' › ');
    const path = fold(pathText);
    for (const node of nodes) {
      if (node.url && foldersOnly) continue;
      const entry = { node, title: fold(label(node)), path, pathText };
      out.push(entry);
      if (node.url) {
        const [host, rest] = splitUrl(node.url);
        Object.assign(entry, { host: fold(host), url: fold(host + rest), hostText: host, restText: rest });
      } else {
        entry.size = folderSize(node);
        walk(node.children, node.folderType === 'bookmarks-bar' ? trail : [...trail, label(node)]);
      }
    }
  })(state.tree, []);
  return out;
}
const indexForSearch = () => (state.searchIndex ??= buildIndex(false));
export const foldersForPicker = () => (state.folderIndex ??= buildIndex(true));

export function findRows(query) {
  const found = rank(indexForSearch(), query);
  state.search.more = Math.max(0, found.length - MAX_HITS);
  return found.slice(0, MAX_HITS).map(({ entry, match }) => {
    // вторая строка: [текст, подсвечивать ли]
    const site = match.deep || !entry.node.title ? entry.hostText + entry.restText : entry.hostText;
    const where = (entry.node.url ? [[site, true]] : [[entry.size, false]])
      .concat(entry.pathText ? [[entry.pathText, true]] : [])
      .filter(([text]) => text);
    return { node: entry.node, depth: 0, hit: { tokens: match.tokens, where } };
  });
}
