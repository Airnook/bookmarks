// История правок закладок из панели: отмена и повтор. Каждая правка — шаг { label, ops }:
// подпись (для сообщения и меню) и обратимые операции над chrome.bookmarks в том порядке,
// в каком их сделали. Правки идут через begin(): шаг сам выполняет операцию и запоминает,
// как её вернуть. Правки вне панели (диспетчер закладок, синхронизация) в историю не попадают.
//
// История общая для всех окон и живёт до закрытия браузера: storage.session, ключ history.
// Восстановленная закладка получает новый id — старый заменяется новым во всей истории
// и в связях вкладок link:<id вкладки>; панель заменяет его у курсора и отметок по map из ответа.
//
// Операции (id и parentId — текущие, path — предки исходного места снизу вверх без корня '0'):
// create { id, parentId, index, title, url?, path }  ↔ удалить
// remove { node: { id, parentId, index, title, url?, children? }, path } ↔ создать заново
// move   { id, from: { parentId, index, path }, to: { parentId, index, path } }
// update { id, before: { title?, url? }, after: { title?, url? } }
// Если шаг уже не выполнить целиком (папку удалили, закладку изменили в другом окне),
// делается то, что можно: изменённое не затирается, восстановленное без родителя
// встаёт в ближайшего сохранившегося предка или в «Другие закладки».
import { ignore } from './util.js';

export const MAX_STEPS = 50;
const KEY = 'history';

// Последнее известное состояние (для меню и проверок без ожидания), обновляется
// при каждой записи — своей и других окон
let cache = { undo: [], redo: [] };
export const canUndo = () => cache.undo.length > 0;
export const canRedo = () => cache.redo.length > 0;
export const undoLabel = () => cache.undo.at(-1)?.label ?? null;
export const redoLabel = () => cache.redo.at(-1)?.label ?? null;

const valid = (h) => (h && Array.isArray(h.undo) && Array.isArray(h.redo) ? h : { undo: [], redo: [] });
async function load() {
  const { [KEY]: h } = await chrome.storage.session.get(KEY);
  return (cache = valid(h));
}
// Хранилище переполнено (огромная удалённая папка) — забываем самые старые шаги
async function save(h) {
  cache = h;
  for (;;) {
    try {
      return await chrome.storage.session.set({ [KEY]: h });
    } catch (e) {
      if (!h.undo.length && !h.redo.length) throw e;
      (h.undo.length ? h.undo : h.redo).shift();
    }
  }
}

// Записи и отмены одного окна — строго по очереди: отмена, нажатая сразу после правки,
// видит уже записанный шаг
let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn));

const getNode = (id) => chrome.bookmarks.get(id).then(([n]) => n, () => null);

async function pathOf(parentId) {
  const path = [];
  for (let id = parentId; id && id !== '0';) {
    path.push(id);
    id = (await getNode(id))?.parentId;
  }
  return path;
}

// Куда вернуть: исходная папка, иначе ближайший сохранившийся предок, иначе «Другие закладки».
// Индекс — только в исходной папке и не дальше её конца.
async function placeIn(path, index) {
  for (const id of path) {
    const folder = await getNode(id);
    if (!folder || folder.url) continue;
    if (id !== path[0]) return { parentId: id, fallback: folder };
    const size = (await chrome.bookmarks.getChildren(id)).length;
    return { parentId: id, index: Math.min(index, size) };
  }
  const other = (await getNode('2')) ?? (await getNode('1'));
  return { parentId: other.id, fallback: other };
}

// Поставить узел так, чтобы он стал index-м в папке. Браузер считает индекс «перед тем,
// кто сейчас на этом месте», поэтому при переносе ниже в той же папке — на один больше.
async function moveTo(node, { parentId, index }) {
  let at = index;
  if (at !== undefined && node.parentId === parentId && node.index < at) at++;
  return chrome.bookmarks.move(node.id, at === undefined ? { parentId } : { parentId, index: at });
}

const snapshot = (n) => ({
  id: n.id, parentId: n.parentId, index: n.index, title: n.title,
  ...(n.url ? { url: n.url } : { children: (n.children ?? []).map(snapshot) }),
});

// Создать узел со всем содержимым заново; map — старый id → новый
async function recreate(snap, place, map) {
  const props = { parentId: place.parentId, title: snap.title, ...(snap.url && { url: snap.url }) };
  if (place.index !== undefined) props.index = place.index;
  const made = await chrome.bookmarks.create(props);
  map.set(snap.id, made.id);
  for (const child of snap.children ?? []) await recreate(child, { parentId: made.id }, map).catch(ignore);
  return made;
}

// Заменить старые id новыми во всём объекте (поля id, parentId и списки path)
function remap(value, map) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      if (typeof v === 'string') { if (map.has(v)) value[i] = map.get(v); } else if (v && typeof v === 'object') remap(v, map);
    });
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    if ((k === 'id' || k === 'parentId') && map.has(v)) value[k] = map.get(v);
    else if (v && typeof v === 'object') remap(v, map);
  }
}

// Вкладки восстановленных закладок снова «открыты» в них
async function relink(map) {
  const all = await chrome.storage.session.get(null);
  const moved = Object.fromEntries(Object.entries(all)
    .filter(([k, v]) => k.startsWith('link:') && map.has(v)).map(([k, v]) => [k, map.get(v)]));
  if (Object.keys(moved).length) await chrome.storage.session.set(moved);
}

const same = (node, values) => Object.entries(values).every(([k, v]) => (node[k] ?? '') === (v ?? ''));

// Выполнить операцию в сторону back (отмена) или вперёд (повтор). Ответ: { done, focus, fallback }:
// done — получилось ли, focus — какой узел показать, fallback — папка, куда пришлось вернуть.
async function apply(op, back, map) {
  const node = op.id ? await getNode(op.id) : null;
  if (op.type === 'update') {
    const [from, to] = back ? [op.after, op.before] : [op.before, op.after];
    if (!node || !same(node, from)) return { done: false }; // изменили в другом окне — не затираем
    await chrome.bookmarks.update(op.id, to);
    return { done: true, focus: op.id };
  }
  if (op.type === 'move') {
    if (!node) return { done: false };
    const target = back ? op.from : op.to;
    const place = await placeIn(target.path, target.index);
    await moveTo(node, place);
    return { done: true, focus: op.id, fallback: place.fallback };
  }
  const removing = (op.type === 'create') === back;
  if (removing) {
    const id = op.type === 'create' ? op.id : op.node.id;
    const current = await chrome.bookmarks.getSubTree(id).then(([n]) => n, () => null);
    if (!current) return { done: false };
    // созданную папку убираем, только если она пуста: внутри может быть положенное позже из другого окна
    if (op.type === 'create' && current.children?.length) return { done: false };
    if (op.type === 'remove') { op.node = snapshot(current); op.path = await pathOf(current.parentId); }
    await (current.url ? chrome.bookmarks.remove(id) : chrome.bookmarks.removeTree(id));
    return { done: true, focus: current.parentId };
  }
  const snap = op.type === 'create' ? op : op.node;
  const place = await placeIn(op.path, snap.index);
  const made = await recreate(snap, place, map);
  return { done: true, focus: made.id, fallback: place.fallback };
}

// Шаг правки. Методы выполняют изменение и запоминают его; ответ — как у chrome.bookmarks
// (null или false — не получилось, в историю не попало). commit — записать шаг в историю.
export function begin() {
  const ops = [];
  const step = {
    ops,
    async create(props) {
      const made = await chrome.bookmarks.create(props).catch(() => null);
      if (made) {
        ops.push({ type: 'create', id: made.id, parentId: made.parentId, index: made.index, title: made.title,
          ...(made.url && { url: made.url }), path: await pathOf(made.parentId) });
      }
      return made;
    },
    async remove(id) {
      const node = await chrome.bookmarks.getSubTree(id).then(([n]) => n, () => null);
      if (!node) return false;
      const path = await pathOf(node.parentId);
      const done = await (node.url ? chrome.bookmarks.remove(id) : chrome.bookmarks.removeTree(id)).then(() => true, () => false);
      if (done) ops.push({ type: 'remove', node: snapshot(node), path });
      return done;
    },
    async move(id, dest) {
      const before = await getNode(id);
      if (!before) return false;
      const fromPath = await pathOf(before.parentId);
      const done = await chrome.bookmarks.move(id, dest).then(() => true, () => false);
      const after = done && await getNode(id);
      if (after) {
        ops.push({ type: 'move', id,
          from: { parentId: before.parentId, index: before.index, path: fromPath },
          to: { parentId: after.parentId, index: after.index, path: await pathOf(after.parentId) } });
      }
      return done;
    },
    async update(id, changes) {
      const node = await getNode(id);
      if (!node) return false;
      const values = (n) => Object.fromEntries(Object.keys(changes).map(k => [k, n[k] ?? '']));
      // после — как записал браузер (адрес он может дописать: «https://a» → «https://a/»)
      const updated = await chrome.bookmarks.update(id, changes).catch(() => null);
      if (updated) ops.push({ type: 'update', id, before: values(node), after: values(updated) });
      return !!updated;
    },
    // join — шаги с одинаковым join подряд сливаются в один (удержанная Alt+↓ — одна отмена)
    commit(label, join = null) {
      if (!ops.length) return Promise.resolve();
      return serial(async () => {
        const h = await load();
        const top = h.undo.at(-1);
        if (join && top?.join === join && !h.redo.length) {
          top.ops.push(...ops);
          top.label = label;
        } else {
          h.undo.push({ label, ops: [...ops], ...(join && { join }) });
        }
        h.undo.splice(0, Math.max(0, h.undo.length - MAX_STEPS));
        h.redo = [];
        await save(h);
      });
    },
  };
  return step;
}

// Отменить (back) или повторить последний шаг. Ответ: { status, label, focus, map, fallback }:
// status — 'empty' (нечего), 'done', 'partial' (сделано не всё), 'failed' (ничего не вышло — шаг
// забыт); focus — узел, который показать; map — старый id → новый (поправить курсор и отметки);
// fallback — папка, куда пришлось вернуть узел, потому что исходной больше нет.
function replay(back) {
  return serial(async () => {
    const h = await load();
    const [from, to] = back ? [h.undo, h.redo] : [h.redo, h.undo];
    const step = from.pop();
    if (!step) return { status: 'empty' };
    const map = new Map();
    let done = 0;
    let focus = null;
    let fallback = null;
    for (const op of back ? [...step.ops].reverse() : step.ops) {
      const before = map.size;
      const r = await apply(op, back, map).catch((e) => { console.error(e); return { done: false }; });
      if (map.size > before) { remap(step, map); remap(h, map); } // следующие операции и шаги — уже с новыми id
      if (!r.done) continue;
      done++;
      fallback ??= r.fallback ?? null;
      if (back || !focus) focus = r.focus; // показываем первое по порядку правки
    }
    if (done) to.push(step);
    if (to.length > MAX_STEPS) to.shift();
    await save(h);
    if (map.size) await relink(map).catch(ignore);
    const status = !done ? 'failed' : done < step.ops.length ? 'partial' : 'done';
    return { status, label: step.label, focus: focus && (map.get(focus) ?? focus), map, fallback };
  });
}
export const undo = () => replay(true);
export const redo = () => replay(false);

export function listenHistory() {
  chrome.storage.session.onChanged.addListener((c) => { if (c[KEY]) cache = valid(c[KEY].newValue); });
  return load().catch(ignore);
}
