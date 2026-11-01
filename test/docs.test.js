// Документация: корень чист, а все относительные ссылки и картинки в .github/ и docs/ ведут на существующие файлы
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = fs.readdirSync(path.join(root, '_locales'));
const mdFiles = ['.github', 'docs'].flatMap(function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []);
});

test('в корне нет README, CONTRIBUTING и TRANSLATING', () => {
  assert.deepEqual(fs.readdirSync(root).filter(f => /^(README|CONTRIBUTING|TRANSLATING)/.test(f)), []);
});

test('README, CONTRIBUTING и TRANSLATING есть на каждом языке', () => {
  for (const name of ['README', 'CONTRIBUTING', 'TRANSLATING']) {
    for (const l of LANGS) {
      const lang = l.replace('_', '-');
      const file = lang === 'en' ? `.github/${name}.md` : `docs/${lang}/${name}.md`;
      assert.ok(fs.existsSync(path.join(root, file)), file);
    }
  }
});

test('относительные ссылки и картинки в документах ведут на существующие файлы', () => {
  const broken = [];
  for (const file of mdFiles) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const refs = [...text.matchAll(/\]\(([^)\s]+)\)|\b(?:src|srcset)="([^"]+)"/g)].map(m => m[1] ?? m[2]);
    for (const ref of refs) {
      if (/^([a-z][a-z0-9+.-]*:|#)/i.test(ref)) continue;
      if (!fs.existsSync(path.join(root, path.dirname(file), ref.split('#')[0]))) broken.push(`${file}: ${ref}`);
    }
  }
  assert.deepEqual(broken, []);
});
