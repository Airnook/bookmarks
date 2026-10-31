// Вид панели: setView / viewStored (panel/actions.js) со стабом хранилища.
// onChanged приходит асинхронно и не приходит, если значение `view` и метка записи не менялись.
import './locale-ru.js';
import test from 'node:test';
import assert from 'node:assert/strict';

// Элементы страницы: любое обращение возвращает заглушку, dataset и класс хранятся настоящими
const el = () => new Proxy({ dataset: {}, classList: { add() {}, remove() {}, toggle() {} } }, {
  get(target, key) {
    if (key in target) return target[key];
    return (target[key] = () => el());
  },
  set(target, key, value) { target[key] = value; return true; },
});
const doc = {
  getElementById: () => el(),
  querySelector: () => el(),
  querySelectorAll: () => [],
  createElement: () => el(),
  createDocumentFragment: () => el(),
  addEventListener() {},
};
globalThis.document = doc;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Стаб chrome.storage.local: событие только при изменении хотя бы одного ключа, асинхронно
function makeStorage() {
  const data = {};
  const listeners = [];
  const local = {
    set(obj) {
      const changes = {};
      for (const key in obj) {
        if (data[key] === obj[key]) continue;
        changes[key] = { oldValue: data[key], newValue: obj[key] };
        data[key] = obj[key];
      }
      if (Object.keys(changes).length) setTimeout(() => listeners.forEach((fn) => fn(changes)));
      return Promise.resolve();
    },
    get: async () => ({ ...data }),
  };
  globalThis.chrome = {
    storage: { local, onChanged: { addListener: (fn) => listeners.push(fn) } },
    i18n: { getMessage: (key) => key },
    runtime: { getURL: (path) => path },
  };
  return { data, local };
}

// Обработчик onChanged из panel/main.js (только вид): что видит экран после каждого события
async function start() {
  const storage = makeStorage();
  const actions = await import('../panel/actions.js');
  const { state } = await import('../panel/state.js');
  const seen = [];
  globalThis.chrome.storage.onChanged.addListener((c) => {
    if (c.view) actions.viewStored(c.view.newValue, c.viewWrite?.newValue);
    seen.push(state.settings.view);
  });
  state.settings.view = 'normal';
  // Имитация чужого окна или страницы настроек: пишут `view` без метки панели
  const foreign = (view) => storage.local.set({ view });
  const press = () => actions.actions['view.cycle']();
  return { actions, state, storage, seen, foreign, press };
}

test('двойное V подряд: эхо первой записи не откатывает экран', async () => {
  const env = await start();
  env.press(); env.press();
  assert.equal(env.state.settings.view, 'dense');
  await tick();
  assert.equal(env.state.settings.view, 'dense');
  assert.equal(env.storage.data.view, 'dense');
  assert.ok(env.seen.every((view) => view === 'dense'), `откат: ${env.seen}`);
});

test('тройное V подряд: экран и хранилище сходятся на последнем виде, откатов нет', async () => {
  const env = await start();
  env.press(); env.press(); env.press();
  await tick();
  assert.equal(env.state.settings.view, 'normal');
  assert.equal(env.storage.data.view, 'normal');
  assert.ok(env.seen.every((view) => view === 'normal'), `откат: ${env.seen}`);
});

test('одинаковый вид из двух окон: без хвоста в очереди чужое изменение применяется', async () => {
  const env = await start();
  env.press(); // normal → detailed, запись панели
  env.foreign('detailed'); // другое окно записало тот же вид: значение не меняется, эха нет
  await tick();
  env.foreign('dense'); // затем другое окно меняет вид — должно примениться
  await tick();
  assert.equal(env.state.settings.view, 'dense');
  assert.equal(env.storage.data.view, 'dense');
});

test('запись того же значения, что уже в хранилище, затем чужое изменение — применяется', async () => {
  const env = await start();
  env.foreign('detailed'); // хранилище стало detailed, экран ещё normal (событие не доставлено)
  env.press(); // экран normal → detailed: совпало с хранилищем, onChanged по `view` не придёт
  env.foreign('dense'); // чужое изменение
  await tick();
  assert.equal(env.state.settings.view, 'dense');
  assert.equal(env.storage.data.view, 'dense');
});

test('чужое изменение между своими записями: в конце экран и хранилище совпадают', async () => {
  const env = await start();
  env.press(); // normal → detailed
  env.foreign('normal'); // другое окно между нашими записями
  env.press(); // detailed → dense
  await tick();
  assert.equal(env.storage.data.view, 'dense');
  assert.equal(env.state.settings.view, 'dense');
  assert.ok(env.seen.at(-1) === 'dense', `конец: ${env.seen}`);
});

test('чужая смена вида при пустой очереди применяется сразу', async () => {
  const env = await start();
  env.foreign('dense');
  await tick();
  assert.equal(env.state.settings.view, 'dense');
  assert.equal(env.seen.at(-1), 'dense');
});
