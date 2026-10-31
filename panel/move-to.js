// Перемещение в папку по имени.
import { shortcutText } from '../commands.js';
import { plural, t } from '../i18n.js';
import { ignore } from './util.js';
import { firstLockedReason, isLocked, label } from './nodes.js';
import { fold, rank } from './search.js';
import { saveState, state } from './state.js';
import { ensureFresh, fetchTree, reveal, targets } from './tree.js';
import { foldersForPicker } from './search-index.js';
import { leaveSearch } from './find.js';
import { begin } from './history.js';
import { enqueue, moveCursorOff, saveStep } from './edit.js';
import { flash } from './ui.js';
import { openPicker } from './palette.js';

const RECENT_FOLDERS = 5;

// Выбор папки для отмеченного (или строки под курсором). В списке нет папок
// внутри перемещаемых (папку в саму себя не положить) и закрытых для изменений.
// Окно открывается сразу, без ожиданий: иначе быстро нажатые следом клавиши
// ушли бы в список как команды. Нет подходящей — можно создать.
export function askMoveTo() {
  const all = targets();
  const group = all.filter(n => !isLocked(n));
  if (!group.length) {
    const reason = firstLockedReason(all, 'edit');
    if (reason) flash(reason);
    return;
  }
  const ids = group.map(n => n.id);
  const blocked = new Set(group.filter(n => !n.url).map(n => n.id));
  const allowed = (folder) => {
    if (folder.unmodifiable) return false;
    for (let n = folder; n; n = state.nodeById.get(n.parentId)) if (blocked.has(n.id)) return false;
    return true;
  };
  const parents = new Set(group.map(n => n.parentId));
  const here = parents.size === 1 ? [...parents][0] : null; // всё лежит в одной папке
  // куда класть новую папку: верх списка (стартовая папка или «Панель закладок»)
  const topFolder = () => (state.treeRoot?.id === '0' ? state.tree.find(n => n.folderType === 'bookmarks-bar') ?? state.tree[0] : state.treeRoot);

  // все папки списка — каждый раз свежие (закладки могли поменяться, пока окно открыто)
  const folders = () => {
    const all = foldersForPicker().filter(e => allowed(e.node));
    if (state.treeRoot?.id === '0') {
      // пустые «Другие закладки» в списке скрыты, но класть туда можно
      for (const node of state.treeRoot.children) {
        if (node.folderType === 'other' && !state.tree.includes(node)) all.push({ node, title: fold(label(node)), path: '', pathText: '' });
      }
    } else if (state.treeRoot) {
      all.unshift({ node: state.treeRoot, title: fold(label(state.treeRoot)), path: '', pathText: t('picker_start_folder') }); // тоже место
    }
    return all;
  };
  const item = (entry, tokens) => ({
    key: entry.node.id, id: entry.node.id, folder: true, title: label(entry.node), tokens,
    sub: entry.node.id === here ? t('picker_here') : entry.pathText,
  });

  openPicker({
    label: t('picker_label'),
    heading: group.length > 1 ? plural('picker_heading_items', group.length) : t('picker_heading', label(group[0])),
    placeholder: t('picker_placeholder'),
    foot: t('picker_foot', shortcutText('Enter'), shortcutText('Shift+Enter')),
    live: true,
    source: (query) => {
      const all = folders();
      const recent = state.recentFolders.map(id => all.find(f => f.node.id === id)).filter(f => f && f.node.id !== here);
      if (!query) {
        // пусто — сначала недавние, потом все по порядку; где лежит сейчас — в конце
        const rest = all.filter(f => !recent.includes(f) && f.node.id !== here);
        const current = all.filter(f => f.node.id === here);
        return [
          ...(recent.length ? [{ section: t('picker_recent') }, ...recent.map(f => item(f))] : []),
          ...(recent.length ? [{ section: t('picker_all') }] : []),
          ...[...rest, ...current].map(f => item(f)),
        ];
      }
      const found = rank(all, query, (f) => (recent.includes(f) ? 5 : 0) - (f.node.id === here ? 5 : 0));
      const items = found.map(({ entry, match }) => item(entry, match.tokens));
      // точного совпадения нет — предложить создать такую папку
      const name = query.trim();
      const top = topFolder();
      if (top && allowed(top) && !all.some(f => f.title === fold(name))) {
        items.push({ key: 'create', create: true, name, parentId: top.id, title: t('picker_create', name), sub: t('picker_create_in', label(top)) });
      }
      return items;
    },
    onPick: (picked, { shift }) => enqueue(async () => {
      const step = begin(); // новая папка и перенос в неё — один шаг
      let folderId = picked.id;
      if (picked.create) {
        const folder = await step.create({ parentId: picked.parentId, title: picked.name });
        if (!folder) return flash(t('create_folder_failed'));
        folderId = folder.id;
        await fetchTree();
      }
      saveStep(step, await moveTo(ids, folderId, shift, step));
    }),
  });
}

// Переместить в конец папки (шагом истории step). follow — перейти туда; иначе курсор остаётся
// на месте (на соседней строке), чтобы разбирать закладки подряд. Возвращает текст сообщения.
async function moveTo(ids, folderId, follow, step) {
  await ensureFresh();
  const all = ids.map(id => state.nodeById.get(id)).filter(Boolean);
  const group = all.filter(n => !isLocked(n));
  const folder = folderId === state.treeRoot?.id ? state.treeRoot : state.nodeById.get(folderId);
  if (!folder) return t('move_folder_gone');
  if (!group.length) return firstLockedReason(all, 'edit') ?? t('move_nothing');
  const moving = group.filter(n => n.parentId !== folderId); // уже там — не трогаем порядок
  if (!moving.length) return t('move_already_there');
  if (!follow) moveCursorOff(moving);
  let moved = 0;
  for (const n of moving) if (await step.move(n.id, { parentId: folderId })) moved++;
  if (state.marked.size) { state.marked.clear(); saveState(); }
  state.recentFolders = [folderId, ...state.recentFolders.filter(id => id !== folderId)].slice(0, RECENT_FOLDERS);
  chrome.storage.local.set({ recentFolders: state.recentFolders }).catch(ignore);
  if (follow) {
    if (state.search) leaveSearch();
    reveal(folderId);
    state.selId = state.scrollTarget = moving[0].id;
    saveState();
  }
  await fetchTree();
  return !moved ? t('move_failed') : moved > 1 ? plural('moved_items', moved, label(folder)) : t('moved', label(folder));
}
