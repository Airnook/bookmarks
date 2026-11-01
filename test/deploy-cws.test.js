import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { deploy, accessToken } from '../scripts/deploy-cws.mjs';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KEY = JSON.stringify({
  client_email: 'bot@p.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  token_uri: 'https://oauth2.example/token',
});
const ENV = { CWS_SERVICE_ACCOUNT_JSON: KEY, CWS_PUBLISHER_ID: 'pub', CWS_ITEM_ID: 'item' };
const ITEM = 'publishers/pub/items/item';
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

// заглушка fetch: отвечает по «метод url» из таблицы, ведёт журнал вызовов
function stub(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, ...init });
    const r = routes[`${init.method ?? 'GET'} ${url}`];
    assert.ok(r, `неожиданный запрос ${init.method} ${url}`);
    return typeof r === 'function' ? r(init) : r;
  };
  return { fn, calls };
}
const TOKEN = { 'POST https://oauth2.example/token': () => reply({ access_token: 'tok' }) };
const UP = `POST https://chromewebstore.googleapis.com/upload/v2/${ITEM}:upload`;
const STATUS = `GET https://chromewebstore.googleapis.com/v2/${ITEM}:fetchStatus`;
const PUBLISH = `POST https://chromewebstore.googleapis.com/v2/${ITEM}:publish`;
const run = (fn, env = ENV) => deploy({ env, zip: () => Buffer.from('zip'), fetch: fn, sleep: async () => {} });

test('токен: JWT RS256 с подписью, проверяемой открытым ключом', async () => {
  const { fn, calls } = stub(TOKEN);
  assert.equal(await accessToken(JSON.parse(KEY), fn, 1000), 'tok');
  const form = new URLSearchParams(calls[0].body);
  assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const [h, p, s] = form.get('assertion').split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url')), {
    iss: 'bot@p.iam.gserviceaccount.com', scope: 'https://www.googleapis.com/auth/chromewebstore',
    aud: 'https://oauth2.example/token', iat: 1000, exp: 4600,
  });
  assert.ok(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url')));
});

test('без секретов: пропуск, ни одного запроса', async () => {
  const { fn, calls } = stub({});
  assert.equal(await run(fn, { CWS_ITEM_ID: 'item' }), 'skipped');
  assert.equal(calls.length, 0);
});

test('успешная загрузка: загрузка → публикация с токеном', async () => {
  const { fn, calls } = stub({ ...TOKEN, [UP]: reply({ uploadState: 'SUCCEEDED' }), [PUBLISH]: reply({ state: 'PENDING_REVIEW' }) });
  assert.equal(await run(fn), 'published');
  const [, up, pub] = calls;
  assert.equal(up.headers.Authorization, 'Bearer tok');
  assert.equal(up.body.toString(), 'zip');
  assert.equal(pub.headers.Authorization, 'Bearer tok');
});

test('загрузка идёт: ждём SUCCEEDED через fetchStatus, потом публикуем', async () => {
  const states = ['IN_PROGRESS', 'SUCCEEDED'];
  const { fn, calls } = stub({
    ...TOKEN, [UP]: reply({ uploadState: 'IN_PROGRESS' }),
    [STATUS]: () => reply({ lastAsyncUploadState: states.shift() }), [PUBLISH]: reply({}),
  });
  await run(fn);
  assert.deepEqual(calls.map(c => c.url.split(':').pop()), ['//oauth2.example/token', 'upload', 'fetchStatus', 'fetchStatus', 'publish']);
});

test('загрузка не удалась: ошибка, публикации нет', async () => {
  const { fn, calls } = stub({ ...TOKEN, [UP]: reply({ uploadState: 'FAILED' }) });
  await assert.rejects(run(fn), /FAILED/);
  assert.ok(!calls.some(c => c.url.endsWith(':publish')));
});

test('ошибка API: сообщение API попадает в исключение', async () => {
  const { fn } = stub({ ...TOKEN, [UP]: reply({ error: { code: 403, message: 'The caller does not have permission' } }, 403) });
  await assert.rejects(run(fn), /403.*The caller does not have permission/);
});

test('ошибка получения токена: сообщение сервиса в исключении', async () => {
  const { fn } = stub({ 'POST https://oauth2.example/token': () => reply({ error: 'invalid_grant', error_description: 'bad key' }, 400) });
  await assert.rejects(run(fn), /bad key/);
});

test('битый JSON секрета: фиксированное сообщение без содержимого секрета', async () => {
  const { fn, calls } = stub({});
  await assert.rejects(run(fn, { ...ENV, CWS_SERVICE_ACCOUNT_JSON: '{"private_key":"TOP-SECRET' }), (e) => {
    assert.match(e.message, /CWS_SERVICE_ACCOUNT_JSON/);
    assert.ok(!e.message.includes('TOP-SECRET'));
    return true;
  });
  assert.equal(calls.length, 0);
});
