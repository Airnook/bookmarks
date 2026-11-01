import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(repo, 'scripts', 'package.mjs');

// Копия репозитория без служебного: сборка и правки идут только в ней
function sandbox(from = repo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-'));
  // сокеты (.codegraph/daemon.sock) cpSync не копирует: берём только файлы и каталоги
  fs.cpSync(from, dir, { recursive: true, filter: (src) => {
    if (/[\\/](node_modules|dist|\.git)$/.test(src)) return false;
    const st = fs.lstatSync(src);
    return st.isFile() || st.isDirectory();
  } });
  return dir;
}
const build = (dir) => spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
const entriesOf = (dir) => {
  const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  return new AdmZip(path.join(dir, 'dist', `airnook-bookmarks-${version}.zip`)).getEntries().map(e => e.entryName);
};

test('сборка: в архиве только нужное браузеру', (t) => {
  const dir = sandbox();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'tool.js'), 'console.log(1);\n'); // ни с чем не связан
  fs.writeFileSync(path.join(dir, '.hidden'), 'x');
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'shot.png'), 'x'); // картинки README
  const r = build(dir);
  assert.equal(r.status, 0, r.stderr);
  const entries = entriesOf(dir);
  assert.ok(!entries.includes('tool.js'));
  for (const f of ['manifest.json', 'panel.html', 'panel/main.js', 'help.html', 'base.css', 'icons/icon16.png']) assert.ok(entries.includes(f), f);
  // модули панели — из импортов, вместе с commands.js
  for (const f of fs.readdirSync(path.join(dir, 'panel'))) assert.ok(entries.includes(`panel/${f}`), f);
  assert.ok(entries.includes('commands.js'));
  // переводы — весь каталог _locales
  for (const l of fs.readdirSync(path.join(dir, '_locales'))) assert.ok(entries.includes(`_locales/${l}/messages.json`), l);
  for (const e of entries) assert.ok(!/package|eslint|test\/|scripts\/|README|TRANSLATING|TODO|CONTRIBUTING|LICENSE|^docs\/|^\./.test(e), e);
});

test('сокет в .codegraph/ не ломает копирование и сборку', async (t) => {
  const src = sandbox();
  t.after(() => fs.rmSync(src, { recursive: true, force: true }));
  fs.mkdirSync(path.join(src, '.codegraph'), { recursive: true });
  const server = net.createServer();
  await new Promise(resolve => server.listen(path.join(src, '.codegraph', 'daemon.sock'), resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const dir = sandbox(src);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const r = build(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(dir, '.codegraph', 'daemon.sock')));
});

test('сборка падает, если ссылка из html ведёт на несуществующий файл', (t) => {
  const dir = sandbox();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.rmSync(path.join(dir, 'base.css'));
  const r = build(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /base\.css/);
});

test('сборка падает, если страница, открываемая из кода, не в EXTRA_PAGES', (t) => {
  const dir = sandbox();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'new.html'), '<p>x</p>');
  fs.appendFileSync(path.join(dir, 'background.js'), "\nchrome.tabs.create({ url: 'new.html' });\n");
  const r = build(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /new\.html/);
});

test('файл, на который больше никто не ссылается, в архив не попадает', (t) => {
  const dir = sandbox();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const f = path.join(dir, 'help.html');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('<script type="module" src="help.js"></script>', ''));
  const r = build(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!entriesOf(dir).includes('help.js'));
});

test('модули, импортированные из модулей, попадают в архив', (t) => {
  const dir = sandbox();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'lib'));
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), "import { b } from './b.js';\nexport * from '../c.js';\nexport const a = b;\n");
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), 'export const b = 1;\n');
  fs.writeFileSync(path.join(dir, 'c.js'), "import '/lib/d.js';\nexport const c = 2;\n");
  fs.writeFileSync(path.join(dir, 'lib', 'd.js'), '');
  fs.writeFileSync(path.join(dir, 'lib', 'unused.js'), 'export const u = 3;\n');
  const f = path.join(dir, 'help.html');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('</body>', '<script type="module" src="lib/a.js"></script>\n</body>'));
  const r = build(dir);
  assert.equal(r.status, 0, r.stderr);
  const entries = entriesOf(dir);
  for (const e of ['lib/a.js', 'lib/b.js', 'c.js', 'lib/d.js']) assert.ok(entries.includes(e), e);
  assert.ok(!entries.includes('lib/unused.js'));
});

test('сборка падает, если модуль импортирует несуществующий файл', (t) => {
  const dir = sandbox();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'help.js'), "import { gone } from './gone.js';\n" + fs.readFileSync(path.join(dir, 'help.js'), 'utf8'));
  const r = build(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /gone\.js/);
});
