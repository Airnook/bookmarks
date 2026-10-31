// Загрузка скриптов расширения в изолированный контекст со стабами окружения.
// background.js — обычный скрипт (не модуль), поэтому грузим его через node:vm.
// ES-модули страниц (commands.js, panel/) тесты импортируют напрямую.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Значения верхнего уровня (const/let/function) не попадают в globalThis контекста,
// поэтому читаем их выражением в том же контексте.
export function load(file, globals = {}) {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, Promise, ...globals });
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  return { ctx, get: (expr) => vm.runInContext(expr, ctx) };
}

// Стаб chrome для background.js: запоминает слушателей и вызовы sidePanel/tabs.
export function makeChrome() {
  const calls = [];
  // объекты из vm-контекста имеют чужие прототипы — клонируем, чтобы deepStrictEqual их узнавал
  const record = (...args) => calls.push(structuredClone(args));
  const listeners = {};
  const ok = (name, result) => (...args) => { record(name, ...args); return Promise.resolve(result); };
  const event = (name) => ({ addListener: (fn) => { (listeners[name] ??= []).push(fn); } });
  let nextTab = 100;
  const session = {};
  const chrome = {
    sidePanel: { setPanelBehavior: ok('setPanelBehavior'), open: ok('open'), close: ok('close'), setOptions: ok('setOptions') },
    runtime: {
      onInstalled: event('onInstalled'), onConnect: event('onConnect'), onMessage: event('onMessage'),
      getManifest: () => ({ version: '1.0.0' }),
    },
    storage: {
      local: { set: ok('local.set') },
      session: {
        get: async (key) => (key in session ? { [key]: session[key] } : {}),
        set: async (obj) => { Object.assign(session, structuredClone(obj)); },
        remove: async (key) => { delete session[key]; },
      },
    },
    tabs: {
      onRemoved: event('onRemoved'), onReplaced: event('onReplaced'),
      create: async (props) => { record('tabs.create', props); return { id: nextTab++, windowId: props.windowId }; },
      get: async (id) => ({ id, windowId: 1 }),
      group: async (opts) => { record('tabs.group', opts); return 7; },
      update: ok('tabs.update'),
    },
    tabGroups: { update: ok('tabGroups.update') },
    windows: { onRemoved: event('windows.onRemoved') }, // имя отдельно от tabs.onRemoved
    commands: { onCommand: event('onCommand') },
  };
  return { chrome, calls, listeners, session };
}
