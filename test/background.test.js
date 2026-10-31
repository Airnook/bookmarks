import test from 'node:test';
import assert from 'node:assert/strict';
import { load, makeChrome } from './load.js';

function setup() {
  const env = makeChrome();
  const bg = load('background.js', { chrome: env.chrome });
  const message = (msg) => env.listeners.onMessage.forEach(fn => fn(msg));
  const command = (windowId, name = 'open-bookmarks') => env.listeners.onCommand.forEach(fn => fn(name, { windowId }));
  const names = () => env.calls.map(c => c[0]);
  const reset = () => { env.calls.length = 0; };
  return { ...env, bg, message, command, names, reset };
}
const panelState = (windowId, instance, focused, closed = false) => ({ type: 'panel-state', windowId, instance, focused, closed });
// Содержимое windows как обычные объекты
const snapshot = (bg) => bg.get('JSON.stringify([...windows].map(([w, m]) => [w, [...m]]))');

test('setState: запоминает фокус панели по окну и instance', () => {
  const { bg } = setup();
  bg.get('setState')(1, 'a', true);
  bg.get('setState')(1, 'b', false);
  assert.equal(snapshot(bg), '[[1,[["a",true],["b",false]]]]');
});

test('setState(null) удаляет панель, а запоздалые сообщения не воскрешают её', () => {
  const { bg } = setup();
  const setState = bg.get('setState');
  setState(1, 'a', true);
  setState(1, 'a', null);
  assert.equal(snapshot(bg), '[[1,[]]]');
  setState(1, 'a', true);
  assert.equal(snapshot(bg), '[[1,[]]]');
});

test('setState: список закрытых ограничен 200', () => {
  const { bg } = setup();
  for (let i = 0; i < 250; i++) bg.get('setState')(1, 'i' + i, null);
  assert.equal(bg.get('gone.size'), 200);
  assert.equal(bg.get("gone.has('i0')"), false);
  assert.equal(bg.get("gone.has('i249')"), true);
});

test('onMessage: panel-state и закрытие панели', () => {
  const { bg, message } = setup();
  message(panelState(2, 'x', true));
  assert.equal(snapshot(bg), '[[2,[["x",true]]]]');
  message(panelState(2, 'x', false, true));
  assert.equal(snapshot(bg), '[[2,[]]]');
  message(null); // мусор не ломает
  message({ type: 'other' });
});

test('onConnect: разрыв порта панели закрывает её', () => {
  const { bg, listeners, message } = setup();
  message(panelState(3, 'p', true));
  let onDisconnect;
  listeners.onConnect[0]({ name: 'panel:3:p', onDisconnect: { addListener: (fn) => { onDisconnect = fn; } } });
  onDisconnect();
  assert.equal(snapshot(bg), '[[3,[]]]');
  // чужие порты игнорируются
  let touched = false;
  listeners.onConnect[0]({ name: 'other:3:p', onDisconnect: { addListener: () => { touched = true; } } });
  assert.equal(touched, false);
});

test('onCommand: чужая команда и отсутствие вкладки игнорируются', () => {
  const { command, names, reset, listeners } = setup();
  reset();
  command(1, 'other');
  listeners.onCommand[0]('open-bookmarks', undefined);
  assert.deepEqual(names(), []);
});

test('onCommand: фокус в панели → закрыть и сбросить фокус', () => {
  const { bg, message, command, calls, reset } = setup();
  message(panelState(1, 'a', true));
  reset();
  command(1);
  assert.deepEqual(calls, [['close', { windowId: 1 }]]);
  assert.equal(snapshot(bg), '[[1,[["a",false]]]]');
});

test('onCommand: о панелях известно, в этом окне их нет → открыть', () => {
  const { message, command, calls, reset } = setup();
  message(panelState(2, 'other', false));
  reset();
  command(1);
  assert.deepEqual(calls, [['open', { windowId: 1 }]]);
});

test('onCommand: в окне пустая карта → открыть', () => {
  const { message, command, calls, reset } = setup();
  message(panelState(1, 'a', true));
  message(panelState(1, 'a', false, true));
  reset();
  command(1);
  assert.deepEqual(calls, [['open', { windowId: 1 }]]);
});

test('onCommand: скрипт только запущен, ничего не известно → пересоздать панель', () => {
  const { command, calls, reset } = setup();
  reset();
  command(1);
  assert.deepEqual(calls, [
    ['setOptions', { enabled: false }],
    ['setOptions', { enabled: true, path: 'panel.html' }],
    ['open', { windowId: 1 }],
  ]);
});

test('onCommand: панель открыта без фокуса → пересоздать', () => {
  const { message, command, calls, reset } = setup();
  message(panelState(1, 'a', false));
  reset();
  command(1);
  assert.deepEqual(calls.map(c => c[0]), ['setOptions', 'setOptions', 'open']);
});

test('onCommand: панель открыта и в другом окне → только закрыть', () => {
  const { message, command, calls, reset } = setup();
  message(panelState(1, 'a', false));
  message(panelState(2, 'b', false));
  reset();
  command(1);
  assert.deepEqual(calls, [['close', { windowId: 1 }]]);
});

test('onRemoved: запись закрытого окна удаляется, остальные не трогаются', () => {
  const { bg, message, listeners } = setup();
  message(panelState(1, 'a', true));
  message(panelState(2, 'b', false));
  listeners['windows.onRemoved'][0](1);
  assert.equal(snapshot(bg), '[[2,[["b",false]]]]');
  listeners['windows.onRemoved'][0](42); // неизвестное окно — ничего не ломает
  assert.equal(snapshot(bg), '[[2,[["b",false]]]]');
});

test('onRemoved: разрыв порта закрытого окна не пересоздаёт его запись', () => {
  const { bg, message, listeners } = setup();
  message(panelState(1, 'a', true));
  listeners['windows.onRemoved'][0](1);
  let onDisconnect;
  listeners.onConnect[0]({ name: 'panel:1:a', onDisconnect: { addListener: (fn) => { onDisconnect = fn; } } });
  onDisconnect();
  assert.equal(snapshot(bg), '[]');
});

test('panel-state закрытого окна не создаёт его запись', () => {
  const { bg, message, listeners } = setup();
  message(panelState(1, 'a', true));
  listeners['windows.onRemoved'][0](1);
  message(panelState(1, 'a', false));
  message(panelState(1, 'b', true));
  assert.equal(snapshot(bg), '[]');
});

test('panel-state нового окна ведёт себя как раньше', () => {
  const { bg, message, listeners } = setup();
  message(panelState(1, 'a', true));
  listeners['windows.onRemoved'][0](1);
  message(panelState(2, 'b', false));
  assert.equal(snapshot(bg), '[[2,[["b",false]]]]');
});

test('onCommand: запоздалое сообщение закрытого окна не мешает пересоздать панель в живом', () => {
  const { message, command, listeners, calls, reset } = setup();
  message(panelState(1, 'a', true));
  listeners['windows.onRemoved'][0](1);
  message(panelState(2, 'x', false));
  message(panelState(1, 'a', true)); // запоздалое
  reset();
  command(2);
  assert.deepEqual(calls.map(c => c[0]), ['setOptions', 'setOptions', 'open']);
});

test('onCommand: после закрытия единственного окна с панелью новое окно открывается как раньше', () => {
  const { message, command, listeners, calls, reset } = setup();
  message(panelState(1, 'a', true));
  listeners['windows.onRemoved'][0](1);
  reset();
  command(2);
  assert.deepEqual(calls, [['open', { windowId: 2 }]]);
});

test('openSet: открывает вкладки, группирует, активирует первую', async () => {
  const { bg, calls, session, reset } = setup();
  reset();
  await bg.get('openSet')({ windowId: 1, items: [{ id: 'b1', url: 'https://a' }, { id: 'b2', url: 'https://b' }], group: 'Набор', link: true });
  assert.deepEqual(calls.map(c => c[0]), ['tabs.create', 'tabs.create', 'tabs.group', 'tabGroups.update', 'tabs.update']);
  assert.deepEqual(calls[2][1], { tabIds: [100, 101], createProperties: { windowId: 1 } });
  assert.deepEqual(calls[3].slice(1), [7, { title: 'Набор' }]);
  assert.deepEqual(calls[4].slice(1), [100, { active: true }]);
  assert.deepEqual({ ...session }, { 'link:100': 'b1', 'link:101': 'b2' });
});

test('openSet: уже открытая вкладка из этого окна переиспользуется, без группы и связей', async () => {
  const { bg, calls, session, reset } = setup();
  reset();
  await bg.get('openSet')({ windowId: 1, items: [{ id: 'b1', url: 'https://a', tabId: 55 }], group: '', link: false });
  assert.deepEqual(calls.map(c => c[0]), ['tabs.update']);
  assert.deepEqual(calls[0].slice(1), [55, { active: true }]);
  assert.deepEqual({ ...session }, {});
});

test('openSet: вкладка из другого окна не берётся, пустой набор ничего не делает', async () => {
  const { bg, calls, reset } = setup();
  reset();
  await bg.get('openSet')({ windowId: 9, items: [{ id: 'b1', url: 'https://a', tabId: 55 }] }); // tabs.get → окно 1
  assert.equal(calls[0][0], 'tabs.create');
  reset();
  await bg.get('openSet')({ windowId: 1, items: [] });
  assert.deepEqual(calls, []);
});
