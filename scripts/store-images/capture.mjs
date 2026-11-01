/* global chrome, document */
// Real screenshots of the extension (device scale factor 2).
// Usage: node scripts/store-images/capture.mjs <extension dir> <output dir>
import path from 'node:path'; import os from 'node:os'; import fs from 'node:fs';
import { chromium } from 'playwright';
const ext = process.argv[2]; const out = process.argv[3];
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'cap-')), {
  channel: 'chromium', headless: true, deviceScaleFactor: 2, locale: 'en-US',
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--lang=en-US'], env: { ...process.env, LANGUAGE: 'en' },
});
const worker = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker');
const id = new URL(worker.url()).host;
const open = async (page, vp) => { const p = await ctx.newPage(); await p.setViewportSize(vp); await p.goto(`chrome-extension://${id}/${page}`); return p; };
const setup = await open('help.html', { width: 600, height: 400 });
await setup.evaluate(async () => {
  const b = (parentId, title, url) => chrome.bookmarks.create({ parentId, title, url });
  const work = await b('1', 'Work');
  await b(work.id, 'Linear — Issues', 'https://linear.app/');
  await b(work.id, 'GitHub', 'https://github.com/');
  await b(work.id, 'Figma', 'https://figma.com/');
  await b(work.id, 'Notion — Team wiki', 'https://notion.so/');
  await b(work.id, 'Google Calendar', 'https://calendar.google.com/');
  const design = await b(work.id, 'Design');
  await b(design.id, 'Dribbble', 'https://dribbble.com/');
  const read = await b('1', 'Reading list');
  await b(read.id, 'Hacker News', 'https://news.ycombinator.com/');
  const docs = await b('1', 'Docs');
  await b(docs.id, 'MDN Web Docs', 'https://developer.mozilla.org/');
  await b('1', 'Travel');
  await b('1', 'Wikipedia', 'https://wikipedia.org/');
  await b('1', 'YouTube', 'https://youtube.com/');
});
const setTheme = (theme) => setup.evaluate((theme) => chrome.storage.local.set({ theme }), theme);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// panel: expand Work + Design, mark GitHub and Figma, cursor on Notion
async function panelShot(name, theme, size = { width: 360, height: 568 }) {
  await setTheme(theme);
  const p = await open('panel.html', size);
  await p.waitForSelector('#list li');
  const go = async (text) => { for (let i = 0; i < 40; i++) { if ((await p.locator('#list li.cur').textContent()) === text) return; await p.keyboard.press('ArrowDown'); } throw new Error(text); };
  await p.keyboard.press('Escape'); // marks and expanded folders are restored from the previous panel
  await p.locator('#list li', { hasText: /^Work$/ }).first().click();
  await p.keyboard.press('ArrowRight').catch(() => {});
  if (!(await p.locator('#list li', { hasText: /^GitHub$/ }).count())) await p.keyboard.press('ArrowRight');
  await go('GitHub'); await p.keyboard.press('Space'); await go('Figma'); await p.keyboard.press('Space'); await go('Notion — Team wiki');
  await p.mouse.move(180, size.height - 20);
  await sleep(500);
  await p.screenshot({ path: path.join(out, `${name}.png`) });
  await p.close();
}
const light = { mode: 'light' }, dark = { mode: 'dark' };
await panelShot('panel-light', light);
await panelShot('panel-dark', dark);
await panelShot('panel-accent', { mode: 'light', colors: { light: { background: '#fbf7f2', text: '#2b2118', accent: '#c2410c' } }, radius: 12 });
// tall version for docs/panel-*.png (360x520 css → 720x1040)
await panelShot('docs-light', light, { width: 360, height: 520 });
await panelShot('docs-dark', dark, { width: 360, height: 520 });
// settings
await setTheme({ mode: 'light', colors: { light: { background: '#fbf7f2', text: '#2b2118', accent: '#c2410c' } }, radius: 12 });
const o = await open('options.html', { width: 780, height: 604 });
await sleep(800);
await o.evaluate(() => document.getElementById('appearance').scrollIntoView());
await sleep(600);
await o.screenshot({ path: path.join(out, 'settings-appearance.png') });
await setTheme({ mode: 'light' });
await o.reload(); await sleep(800);
await o.evaluate(() => document.querySelector('[data-preset=vim]').closest('section').scrollIntoView());
await sleep(600);
await o.screenshot({ path: path.join(out, 'settings-hotkeys.png') });
await ctx.close();
