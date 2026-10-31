// Буфер закладок: вырезанное и скопированное в панели, для «Вставить». Свой, а не системный:
// в нём узлы целиком (снимок папки со всем содержимым). Общий для всех окон и живёт до закрытия
// браузера: storage.session, ключ clipboard — { mode: 'copy' | 'cut', items: [снимок] },
// снимок — { id, title, url } у закладки, { id, title, children: [снимок] } у папки.
// Копия вставляется новыми узлами из снимка (исходные могли с тех пор измениться или исчезнуть),
// вырезанное — переносом исходных узлов по id; после вставки вырезанного буфер пуст.
// Вставка — один шаг истории (history.js).
import { ignore } from './util.js';

const KEY = 'clipboard';

// Последнее известное содержимое (для меню без ожидания), обновляется при каждой записи — своей и других окон
let cache = null;
const valid = (c) => (c && (c.mode === 'copy' || c.mode === 'cut') && Array.isArray(c.items) && c.items.length ? c : null);
export const clipboardEmpty = () => !cache;
export const clipboardMode = () => cache?.mode ?? null;
// id вырезанного (верхние узлы) — нельзя вставить папку внутрь неё самой
export const cutIds = () => (cache?.mode === 'cut' ? cache.items.map(i => i.id) : []);

const snapshot = (n) => ({ id: n.id, title: n.title, ...(n.url ? { url: n.url } : { children: (n.children ?? []).map(snapshot) }) });
const getNode = (id) => chrome.bookmarks.get(id).then(([n]) => n, () => null);

// Положить узлы в буфер. Ответ — сколько положено (исчезнувшие пропущены); ошибка записи
// (буфер переполнен огромной папкой) — исключение, прежнее содержимое остаётся
export async function putInClipboard(ids, mode) {
  const nodes = (await Promise.all(ids.map(id => chrome.bookmarks.getSubTree(id).then(([n]) => n, () => null)))).filter(Boolean);
  if (!nodes.length) return 0;
  const clip = { mode, items: nodes.map(snapshot) };
  await chrome.storage.session.set({ [KEY]: clip });
  cache = clip;
  return nodes.length;
}

// Содержимое буфера прямо из хранилища (другое окно могло его сменить), null — пуст
export async function readClipboard() {
  const { [KEY]: stored } = await chrome.storage.session.get(KEY);
  return (cache = valid(stored));
}

// Вырезанное вставили — буфер пуст (во всех окнах)
export async function clearClipboard() {
  cache = null;
  await chrome.storage.session.remove(KEY).catch(ignore);
}

// Папка parentId — одна из ids или лежит внутри них? (папку не вставить внутрь неё самой)
export async function insideOf(parentId, ids) {
  for (let id = parentId; id && id !== '0'; id = (await getNode(id))?.parentId) if (ids.has(id)) return true;
  return false;
}

async function copyTree(step, snap, place) {
  const made = await step.create({ ...place, title: snap.title, ...(snap.url && { url: snap.url }) });
  if (!made) return null;
  for (const child of snap.children ?? []) await copyTree(step, child, { parentId: made.id });
  return made;
}

// Вставить копию из буфера clip (новые узлы из снимка) в папку parentId перед её index-м ребёнком
// (без index — в конец); step — шаг истории. Ответ: { status: 'done' | 'partial', ids } — ids — вставленные
// верхние узлы по порядку. Вырезанное вставляет перенос (moveGroup в edit.js, как у Alt+↑↓ и мыши).
export async function pasteCopy(step, clip, { parentId, index }) {
  // каждый следующий встаёт перед тем, кто был на месте index, — порядок буфера сохраняется.
  // Браузер считает индекс «перед тем, кто на этом месте»
  const children = await chrome.bookmarks.getChildren(parentId).catch(() => []);
  const anchor = index === undefined ? null : children[index] ?? null;
  const ids = [];
  for (const item of clip.items) {
    const at = anchor && (await getNode(anchor.id))?.index;
    const made = await copyTree(step, item, at === undefined || at === null ? { parentId } : { parentId, index: at });
    if (made) ids.push(made.id);
  }
  return { status: ids.length === clip.items.length ? 'done' : 'partial', ids };
}

export function listenClipboard() {
  chrome.storage.session.onChanged.addListener((c) => { if (KEY in c) cache = valid(c[KEY].newValue); });
  return chrome.storage.session.get(KEY).then(({ [KEY]: c }) => { cache = valid(c); }, ignore);
}
