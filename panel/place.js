// Куда встаёт переносимая группа: цель перетаскивания по строке списка и индексы для chrome.bookmarks.move.
// Чистые функции: без DOM и состояния панели.

// Цель перетаскивания группы group (узлы, порядок дерева) на строку rows[i] ({ node, depth });
// i === rows.length — ниже последней строки. part — где указатель по высоте строки (0 — верх, 1 — низ).
// Верхняя четверть строки — перед ней, нижняя — после неё, на её уровне; середина папки — внутрь
// (раскрытой — в начало, как в аутлайнере, свёрнутой — в конец), у закладки — по половинам.
// Низ раскрытой папки — тоже в её начало: линия там стоит между папкой и её первым ребёнком.
// byId(id) — узел по id (и корень списка rootId), expanded — раскрытые папки.
// Ответ: { folderId, beforeId — встать перед этим ребёнком (не из группы), null — в конец,
// show: { row, at: 'before' | 'after' | 'into', depth } — что показать } или null, если сюда нельзя:
// в саму группу и внутрь перемещаемых папок, в закрытые для изменений папки, на уровень корня ('0').
export function dropTarget({ rows, i, part, group, byId, rootId, expanded }) {
  const inGroup = new Set(group.map(n => n.id));
  const insideGroup = (node) => {
    for (let n = node; n; n = byId(n.parentId)) if (inGroup.has(n.id)) return true;
    return false;
  };
  // первый ребёнок папки начиная с позиции k, не из группы
  const nextOf = (folder, k) => folder.children.slice(k).find(c => !inGroup.has(c.id))?.id ?? null;

  let folder, beforeId, show;
  if (i >= rows.length) {
    if (!rows.length) return null;
    folder = byId(rootId);
    beforeId = null;
    show = { row: rows.length - 1, at: 'after', depth: 0 };
  } else {
    const { node, depth } = rows[i];
    if (insideGroup(node)) return null;
    const open = !node.url && expanded.has(node.id);
    const zone = node.url ? (part < 0.5 ? 'before' : 'after')
      : part < 0.25 ? 'before' : part > 0.75 && !open ? 'after' : 'into';
    if (zone === 'into') {
      folder = node;
      beforeId = open ? nextOf(node, 0) : null;
      show = part > 0.75 ? { row: i, at: 'after', depth: depth + 1 } : { row: i, at: 'into', depth };
    } else {
      folder = byId(node.parentId);
      if (!folder) return null;
      const k = folder.children.findIndex(c => c.id === node.id);
      beforeId = nextOf(folder, zone === 'before' ? k : k + 1);
      show = { row: i, at: zone, depth };
    }
  }
  if (!folder || folder.url || folder.id === '0' || folder.unmodifiable || insideGroup(folder)) return null;
  return { folderId: folder.id, beforeId, show };
}

// Индексы для переноса ids (по одному, по порядку) в папку с детьми order перед ребёнком beforeId
// (нет его в папке или null — в конец), чтобы они встали туда одним блоком. Индекс в move — «перед тем,
// кто сейчас стоит на этом месте» (так считает браузер; при переносе ниже в той же папке он сам вычитает
// единицу), поэтому порядок детей ведём здесь же. Ответ: [{ id, index }]; пусто — порядок бы не изменился.
export function moveIndexes(order, ids, beforeId) {
  const was = order;
  order = [...order];
  const moves = [];
  for (const id of ids) {
    const at = beforeId ? order.indexOf(beforeId) : -1;
    let index = at >= 0 ? at : order.length;
    moves.push({ id, index });
    const old = order.indexOf(id);
    if (old >= 0) { order.splice(old, 1); if (old < index) index--; }
    order.splice(index, 0, id);
  }
  return order.length === was.length && order.every((id, k) => id === was[k]) ? [] : moves;
}
