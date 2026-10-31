// Тексты интерфейса — только в _locales: в коде и разметке расширения кириллицы быть
// не должно (кроме комментариев и исключений ниже). Ловит строку, которую забыли перевести.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const CYRILLIC = /\p{Script=Cyrillic}/u;

// Исключения: файл → литералы, в которых кириллица — не текст интерфейса
const JS_ALLOWED = {
  // поиск сравнивает «е» и «ё» как одну букву — это обработка текста закладок, не надпись
  'panel/search.js': ["'ё'", "'е'"],
};
const files = (ext) => [
  ...fs.readdirSync(root).filter(f => f.endsWith(ext) && f !== 'eslint.config.js'),
  ...(ext === '.js' ? fs.readdirSync(path.join(root, 'panel')).filter(f => f.endsWith('.js')).map(f => `panel/${f}`) : []),
];
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

test('скрипты: нет кириллицы в строках, шаблонах и регулярных выражениях', () => {
  const found = [];
  for (const file of files('.js')) {
    const source = read(file);
    const tokens = espree.tokenize(source, { ecmaVersion: 'latest', sourceType: file === 'background.js' ? 'script' : 'module', range: true });
    for (const token of tokens) {
      if (!CYRILLIC.test(token.value) || JS_ALLOWED[file]?.includes(token.value)) continue;
      found.push(`${file}:${lineOf(source, token.range[0])}: ${token.value}`);
    }
  }
  assert.deepEqual(found, []);
});

test('страницы, стили и манифест: нет кириллицы вне комментариев', () => {
  const found = [];
  const scan = (file, text) => {
    for (const m of text.matchAll(/.*\p{Script=Cyrillic}.*/gu)) found.push(`${file}: ${m[0].trim()}`);
  };
  for (const file of files('.html')) {
    const html = read(file);
    // комментарии разметки и стилей — по-русски, как в коде
    scan(file, html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, ''));
  }
  for (const file of files('.css')) scan(file, read(file).replace(/\/\*[\s\S]*?\*\//g, ''));
  scan('manifest.json', read('manifest.json'));
  assert.deepEqual(found, []);
});

test('исключения на месте: иначе их пора убрать', () => {
  for (const [file, literals] of Object.entries(JS_ALLOWED)) for (const l of literals) assert.ok(read(file).includes(l), `${file}: ${l}`);
});
