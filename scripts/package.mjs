// Сборка релизного архива: dist/airnook-bookmarks-<версия>.zip.
// Состав — замыкание ссылок: manifest.json → всё, на что он ссылается → для каждой
// html-страницы её <script src>, <link href>, <img src>, для каждого скрипта — его статические
// import / export … from → рекурсивно. Плюс _locales/
// и страницы из EXTRA_PAGES. Всё остальное (инструменты, тесты, документы) в архив не попадает.
// После сборки архив проверяется независимо: нет запрещённых файлов, все ссылки на месте.
//
// Использование: node scripts/package.mjs [корень расширения]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

// Страницы, которые открываются из кода по имени (chrome.tabs.create, getURL), а не из
// manifest или html, поэтому по ссылкам их не найти. Каждая обязана существовать.
const EXTRA_PAGES = ['help.html'];
const DIRS = ['_locales'];

// Этого в релизе быть не должно, что бы ни попало в замыкание
const FORBIDDEN = [
  /^package(-lock)?\.json$/, /^eslint\.config\./, /^node_modules\//, /^test\//, /^scripts\//,
  /^\.github\//, /^dist\//, /^CONTRIBUTING(\.[\w-]+)?\.md$/, /^TODO\.md$/, /^README(\.[\w-]+)?\.md$/, /^TRANSLATING\.md$/, /^LICENSE$/, /^docs\//, /(^|\/)\./,
];

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile();
const isLocal = (p) => p && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(p);
// путь от корня расширения; «/x» — от корня, остальное — от каталога ссылающегося файла
const clean = (p, from = '.') => path.posix.normalize(path.posix.join(p.startsWith('/') ? '.' : from, p.split(/[?#]/)[0].replace(/^\//, '')));

const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.posix.join(dir, e.name)) : [path.posix.join(dir, e.name)]);

// Файлы, на которые ссылается manifest: любое строковое значение с расширением файла
// (service_worker, default_path, page, иконки…); имя, описание и сочетания клавиш под это не подходят
function manifestRefs() {
  const refs = [];
  const visit = (v) => {
    if (typeof v === 'string') { if (/^[\w./-]+\.(png|jpe?g|svg|js|html|css|json)$/.test(v)) refs.push(clean(v)); }
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(JSON.parse(read('manifest.json')));
  return refs;
}

function htmlRefs(file) {
  const html = read(file);
  const dir = path.posix.dirname(file);
  const found = [
    ...html.matchAll(/<(?:script|img)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi),
    ...html.matchAll(/<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi),
  ].map(m => m[1]);
  return found.filter(isLocal).map(p => clean(p, dir));
}

// Статические импорты ES-модуля: import … from 'x', import 'x', export … from 'x'.
// Динамический import() не ищем: в расширении его нет. В обычном скрипте таких строк быть не может.
function jsRefs(file) {
  const found = [...read(file).matchAll(/(?:^|[;}\s])(?:import|export)\s+(?:[\w*${}\s,]*?\sfrom\s*)?['"]([^'"]+)['"]/g)].map(m => m[1]);
  return found.filter(isLocal).map(p => clean(p, path.posix.dirname(file)));
}

// Замыкание ссылок; возвращает [файлы, ошибки]
function collect() {
  const errors = [];
  const files = new Set(['manifest.json']);
  const queue = [...manifestRefs(), ...EXTRA_PAGES];
  while (queue.length) {
    const f = queue.shift();
    if (files.has(f)) continue;
    if (!exists(f)) { errors.push(`нет файла, на который есть ссылка: ${f}`); continue; }
    files.add(f);
    if (f.endsWith('.html')) queue.push(...htmlRefs(f));
    if (f.endsWith('.js')) queue.push(...jsRefs(f));
  }
  for (const dir of DIRS) if (fs.existsSync(path.join(root, dir))) walk(dir).forEach(f => files.add(f));
  // html-страницы, на которые код ссылается по имени, должны быть в составе
  for (const f of [...files].filter(f => f.endsWith('.js'))) {
    for (const m of read(f).matchAll(/['"`]([\w./-]+\.html)['"`]/g)) {
      const page = clean(m[1]);
      if (!files.has(page)) errors.push(`${f} ссылается на ${page}, которой нет в архиве (добавьте в EXTRA_PAGES)`);
    }
  }
  return [[...files].sort(), errors];
}

// Независимая проверка готового архива
function verify(zipPath) {
  const entries = new AdmZip(zipPath).getEntries().filter(e => !e.isDirectory).map(e => e.entryName);
  const errors = entries.filter(e => FORBIDDEN.some(re => re.test(e))).map(e => `в архиве запрещённый файл: ${e}`);
  if (!entries.includes('manifest.json')) errors.push('в архиве нет manifest.json');
  const refs = [
    ...manifestRefs(), ...EXTRA_PAGES,
    ...entries.filter(e => e.endsWith('.html')).flatMap(htmlRefs),
    ...entries.filter(e => e.endsWith('.js')).flatMap(jsRefs),
  ];
  for (const r of new Set(refs)) if (!entries.includes(r)) errors.push(`файл есть в ссылках, но нет в архиве: ${r}`);
  return { entries, errors };
}

const { version } = JSON.parse(read('manifest.json'));
const [files, errors] = collect();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const out = path.join(root, 'dist', `airnook-bookmarks-${version}.zip`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
const zip = new AdmZip();
for (const f of files) zip.addLocalFile(path.join(root, f), path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f));
zip.writeZip(out);

const result = verify(out);
if (result.errors.length) { console.error(result.errors.join('\n')); process.exit(1); }
console.log(`${path.relative(process.cwd(), out)}: ${result.entries.length} файлов`);
for (const e of result.entries) console.log('  ' + e);
