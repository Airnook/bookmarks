// Страница настроек в изолированном контексте: i18n.js, commands.js и options.js в одном контексте node:vm.
// Все — ES-модули; в vm они идут как обычные скрипты: импорты убираем, export снимаем,
// и options.js находит имена i18n.js и commands.js в общем контексте (что импорты на месте, проверяет линтер).
// DOM и chrome — стабы: держат состояние элементов и слушателей, поведения браузера
// не воспроизводят. Тесты дёргают слушателей напрямую.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMessageFor } from './i18n-stub.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Модуль → скрипт: без import … from '…'; и без слова export перед объявлениями
const asScript = (source) => source
  .replace(/^import\s[^;]*?\sfrom\s*['"][^'"]+['"];?$/gm, '')
  .replace(/^export (?=(const|let|function|async|class)\b)/gm, '');

class Option {
  constructor(text = '', value = '') { this.textContent = text; this.value = value; }
}

// Элемент страницы. У select значение — только из его options, как в браузере.
class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.textContent = '';
    this.className = '';
    this.checked = false;
    this.dataset = {};
    this.children = [];
    this.listeners = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
    this._value = '';
  }
  get value() { return this._value; }
  set value(v) { this._value = this.children.some(o => o.value === v) ? v : ''; }
  replaceChildren(...nodes) { this.children = nodes; this._value = nodes[0]?.value ?? ''; }
  append(...nodes) { this.children.push(...nodes); }
  focus() {}
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  contains() { return false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  click() {}
}

// Открывает страницу настроек. tree — дерево закладок (можно менять по ходу теста), saved — хранилище,
// lang — язык браузера
export function loadOptions({ tree, saved = {}, lang = 'ru', commands = [] }) {
  const store = structuredClone(saved);
  const storageSets = [];        // что страница записала в хранилище
  const storageListeners = [];
  const bookmarkListeners = {};
  const counters = { getTree: 0 };
  const docListeners = {};
  const downloads = [];          // файлы, которые страница дала скачать: { name, text }
  const opened = [];             // адреса вкладок, которые страница открыла
  const els = new Map();
  const byId = (id) => {
    if (!els.has(id)) els.set(id, new FakeElement(id));
    return els.get(id);
  };
  byId('view').replaceChildren(...['normal', 'detailed', 'dense'].map(v => new Option(v, v)));

  const bookmarkEvent = (name) => ({ addListener: (fn) => { (bookmarkListeners[name] ??= []).push(fn); } });
  const chrome = {
    bookmarks: {
      getTree: async () => { counters.getTree++; return [tree]; },
      onCreated: bookmarkEvent('onCreated'),
      onRemoved: bookmarkEvent('onRemoved'),
      onChanged: bookmarkEvent('onChanged'),
      onMoved: bookmarkEvent('onMoved'),
      onChildrenReordered: bookmarkEvent('onChildrenReordered'),
      onImportBegan: bookmarkEvent('onImportBegan'),
      onImportEnded: bookmarkEvent('onImportEnded'),
    },
    storage: {
      local: {
        get: async (query) => {
          if (typeof query === 'string') return { [query]: store[query] };
          return Object.fromEntries(Object.entries(query).map(([k, d]) => [k, k in store ? store[k] : d]));
        },
        set: async (obj) => {
          const changes = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = structuredClone(v);
          }
          storageSets.push(obj);
          for (const fn of storageListeners) fn(changes);
        },
        onChanged: { addListener: (fn) => storageListeners.push(fn) },
      },
    },
    commands: { getAll: async () => commands },
    runtime: { getManifest: () => ({ version: '2.6.0' }) },
    tabs: { create: async ({ url }) => { opened.push(url); return {}; } },
    i18n: { getMessage: getMessageFor(lang) },
  };
  const document = {
    getElementById: byId,
    createElement: (tag) => {
      const el = new FakeElement(tag);
      if (tag === 'a') el.click = () => downloads.push({ name: el.download, text: el.href.text });
      return el;
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: (type, fn) => { (docListeners[type] ??= []).push(fn); },
    activeElement: null,
    documentElement: new FakeElement('html'),
  };

  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Promise, Option, chrome, document, structuredClone, performance,
    window: { addEventListener() {} },
    Blob: class { constructor(parts) { this.text = parts.join(''); } },
    URL: { createObjectURL: (blob) => blob, revokeObjectURL() {} },
    navigator: { platform: 'Linux x86_64' },
  });
  for (const file of ['i18n.js', 'commands.js', 'settings-file.js', 'theme.js', 'options.js']) {
    vm.runInContext(asScript(fs.readFileSync(path.join(root, file), 'utf8')), ctx, { filename: file });
  }

  return {
    get: (expr) => vm.runInContext(expr, ctx),
    el: byId,
    store,
    storageSets,
    counters,
    opened,
    downloads,
    // нажатие клавиши на странице: { key, code, ctrlKey… }
    keydown: (e) => docListeners.keydown?.forEach(fn => fn({
      key: '', code: '', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
      preventDefault() {}, stopPropagation() {}, ...e,
    })),
    // элементы страницы, созданные кодом, по классу (обход вглубь от элемента с id)
    find: (id, className) => {
      const out = [];
      const walk = (n) => { if (n?.className?.split?.(' ').includes(className)) out.push(n); n?.children?.forEach(walk); };
      walk(byId(id));
      return out;
    },
    // изменение хранилища из другой вкладки или панели
    emitChanged: (changes) => storageListeners.forEach(fn => fn(changes)),
    emitBookmark: (name) => bookmarkListeners[name].forEach(fn => fn({})),
    // фокус на элементе страницы и его уход (blur), как в браузере: activeElement меняется до blur
    focusEl: (id) => { document.activeElement = byId(id); },
    blurEl: (id) => {
      document.activeElement = null;
      byId(id).listeners.blur?.forEach(fn => fn({}));
    },
  };
}
