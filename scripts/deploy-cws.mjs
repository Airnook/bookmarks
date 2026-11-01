// Выкладка архива из dist/ в Chrome Web Store (API v2): токен сервисного аккаунта →
// загрузка → ожидание конца загрузки → отправка на публикацию.
// Секреты: CWS_SERVICE_ACCOUNT_JSON, CWS_PUBLISHER_ID, CWS_ITEM_ID; без них шаг пропускается.
// Использование: node scripts/deploy-cws.mjs [архив]   (по умолчанию dist/*.zip)
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const API = 'https://chromewebstore.googleapis.com';
const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = body.error;
    throw new Error(`${res.status}: ${e?.message ?? body.error_description ?? (typeof e === 'string' ? e : res.statusText)}`);
  }
  return body;
}

// JWT RS256 → обмен на access token (OAuth 2.0 для сервисных аккаунтов)
export async function accessToken(key, fetch, now = Math.floor(Date.now() / 1000)) {
  const head = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email, scope: SCOPE, aud: key.token_uri, iat: now, exp: now + 3600,
  })}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(head), key.private_key).toString('base64url');
  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${sig}` }),
  });
  return (await json(res)).access_token;
}

// 'skipped' | 'published'; любая ошибка API — исключение с сообщением API
// zip — функция, читающая архив: без секретов архив не нужен и может не существовать
export async function deploy({ env, zip, fetch = globalThis.fetch, sleep = (ms) => new Promise(r => setTimeout(r, ms)) }) {
  const { CWS_SERVICE_ACCOUNT_JSON: account, CWS_PUBLISHER_ID: publisher, CWS_ITEM_ID: item } = env;
  if (!account || !publisher || !item) return 'skipped';
  const token = await accessToken(JSON.parse(account), fetch);
  const headers = { Authorization: `Bearer ${token}` };
  const name = `publishers/${publisher}/items/${item}`;

  let { uploadState: state } = await json(await fetch(`${API}/upload/v2/${name}:upload`, { method: 'POST', headers, body: zip() }));
  // shortcut: ждём до ~5 минут, потом ошибка; удлинить, если стор станет обрабатывать дольше
  for (let i = 0; state === 'IN_PROGRESS' && i < 30; i++) {
    await sleep(10_000);
    ({ lastAsyncUploadState: state } = await json(await fetch(`${API}/v2/${name}:fetchStatus`, { headers })));
  }
  if (state !== 'SUCCEEDED') throw new Error(`загрузка не завершилась успешно: ${state}`);

  await json(await fetch(`${API}/v2/${name}:publish`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  }));
  return 'published';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const zip = () => fs.readFileSync(process.argv[2] ?? `dist/${fs.readdirSync('dist').find(f => f.endsWith('.zip'))}`);
    const result = await deploy({ env: process.env, zip });
    console.log(result === 'skipped'
      ? '::notice::Chrome Web Store: секреты CWS_* не заданы, выкладка пропущена'
      : 'Chrome Web Store: версия загружена и отправлена на проверку');
  } catch (e) {
    console.error(`::error::Chrome Web Store: ${e.message}`);
    process.exit(1);
  }
}
