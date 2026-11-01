// Демо-режим панели (panel.html?demo): превью оформления в настройках. Это та же страница панели,
// но chrome подменён здесь, в одном месте: закладки — фиксированные демо-данные, правки отклоняются,
// хранилища и localStorage — в памяти. Настоящих закладок и настроек страница не видит и не меняет.
// Подключается первым импортом panel/main.js, до остальных модулей.
export const DEMO_TREE = {
  id: '0', title: '', children: [
    { id: '1', title: 'Bar', children: [
      { id: '10', title: 'Work', children: [
        { id: '11', title: 'Project board', url: 'https://example.com/board' },
        { id: '12', title: 'Design notes', url: 'https://example.com/notes' },
        { id: '13', title: 'Archive', children: [{ id: '14', title: 'Old plans', url: 'https://example.com/old' }] },
      ] },
      { id: '15', title: 'Reading list', url: 'https://example.com/reading' },
      { id: '16', title: 'Weather', url: 'https://example.com/weather' },
    ] },
    { id: '2', title: 'Other', children: [{ id: '20', title: 'Recipes', children: [{ id: '21', title: 'Pasta', url: 'https://example.com/pasta' }] }] },
  ],
};
const WINDOW = 1;
const OPEN_URL = 'https://example.com/weather'; // закладка с открытой вкладкой
const MARKED = '12';                             // отмеченная закладка

const event = () => { const fns = []; return { addListener: (fn) => fns.push(fn), fire: (...a) => fns.forEach(fn => fn(...a)) }; };
const nothing = async () => undefined;

// storage.area в памяти: get(строка | список | {ключ: умолчание} | null), set, remove, onChanged
function memoryArea(initial = {}) {
  const data = structuredClone(initial);
  const onChanged = event();
  const pick = (keys) => {
    if (keys == null) return structuredClone(data);
    if (typeof keys === 'object' && !Array.isArray(keys)) return Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, structuredClone(k in data ? data[k] : d)]));
    return Object.fromEntries([keys].flat().filter(k => k in data).map(k => [k, structuredClone(data[k])]));
  };
  return {
    get: async (keys) => pick(keys),
    async set(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) { changes[k] = { oldValue: data[k], newValue: structuredClone(v) }; data[k] = structuredClone(v); }
      onChanged.fire(changes);
    },
    async remove(keys) {
      const changes = {};
      for (const k of [keys].flat()) if (k in data) { changes[k] = { oldValue: data[k] }; delete data[k]; }
      onChanged.fire(changes);
    },
    onChanged,
  };
}

export function makeDemoChrome(real = globalThis.chrome) {
  const index = new Map();
  (function walk(n, parentId, i) {
    const { children, ...rest } = n;
    index.set(n.id, { ...rest, ...(parentId && { parentId }), index: i, ...(children && { kids: children }) });
    children?.forEach((c, j) => walk(c, n.id, j));
  })(DEMO_TREE, undefined, 0);
  const plain = ({ kids, ...n }) => n;
  const sub = (id) => { const n = index.get(id); return { ...plain(n), ...(n.kids && { children: n.kids.map(k => sub(k.id)) }) }; };
  const need = (id) => { if (!index.has(id)) throw new Error(`Can't find bookmark for id. ${id}`); return id; };
  const refuse = async () => { throw new Error('Demo bookmarks are read-only'); };

  const tabEvents = Object.fromEntries(['onCreated', 'onRemoved', 'onActivated', 'onAttached', 'onDetached', 'onReplaced', 'onUpdated'].map(e => [e, event()]));
  const state = {
    // раскрыто, курсор и отметка — как «сохранённое прошлой панелью» (panel/state.js); at — вперёд: отметка не успеет «устареть»
    expanded: ['1', '10', '13'], selId: '11', marked: [MARKED], win: WINDOW, at: Date.now() + 3600e3,
  };
  const localStorage = { getItem: (k) => (k === 'state' ? JSON.stringify(state) : null), setItem() {}, removeItem() {} };

  return {
    i18n: real.i18n,
    localStorage,
    bookmarks: {
      get: async (id) => [plain(index.get(need(id)))],
      getChildren: async (id) => (index.get(need(id)).kids ?? []).map(k => plain(index.get(k.id))),
      getSubTree: async (id) => [sub(need(id))],
      getTree: async () => [sub('0')],
      create: refuse, update: refuse, move: refuse, remove: refuse, removeTree: refuse,
      onCreated: event(), onRemoved: event(), onChanged: event(), onMoved: event(), onChildrenReordered: event(),
      onImportBegan: event(), onImportEnded: event(),
    },
    // pinnedTabs — чтобы в демо была закладка с открытой вкладкой
    storage: { local: memoryArea({ pinnedTabs: true }), session: memoryArea() },
    tabs: {
      ...tabEvents,
      query: async () => [{ id: 1, windowId: WINDOW, active: true, url: OPEN_URL }],
      create: nothing, update: nothing, remove: nothing,
    },
    windows: { getCurrent: async () => ({ id: WINDOW, focused: true }), onFocusChanged: event(), update: nothing, create: nothing },
    runtime: { getURL: (p) => real.runtime.getURL(p), sendMessage: nothing, connect: () => ({ onDisconnect: event() }), openOptionsPage: nothing },
    extension: { isAllowedIncognitoAccess: async () => false },
    sidePanel: { close: nothing },
  };
}

// В настоящей странице: подменить chrome и localStorage и принимать тему от окна настроек
if (globalThis.location?.search === '?demo') {
  const demo = makeDemoChrome();
  globalThis.chrome = demo;
  Object.defineProperty(globalThis, 'localStorage', { value: demo.localStorage });
  addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data?.type === 'demo-theme') demo.storage.local.set({ theme: e.data.theme });
  });
}
