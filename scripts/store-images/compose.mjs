/* global document */
// Store images: HTML browser-window mockups around the REAL screenshots from capture.mjs, rendered to exact sizes.
// Usage: node scripts/store-images/compose.mjs <capture dir> <store dir>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const [raw, out] = process.argv.slice(2).map(p => path.resolve(p));
const icon = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../icons/icon128.png'));
const img = (n) => pathToFileURL(path.join(raw, `${n}.png`));

const THEMES = {
  light: { bg: 'linear-gradient(135deg,#e8eefc,#f6ece4)', cap: '#1d1f23', win: '#fff', strip: '#dde1e8', bar: '#f1f3f6', url: '#fff', txt: '#1d1f23', page: '#fff', blk: '#e9ecf1', side: '#fff', sideHead: '#f6f7f9', line: '#d6d9df', shadow: '0 24px 60px rgba(30,40,80,.28)' },
  dark: { bg: 'linear-gradient(135deg,#171a22,#2a2233)', cap: '#f2f3f5', win: '#1c1d21', strip: '#101114', bar: '#232428', url: '#34363b', txt: '#e8e9eb', page: '#1c1d21', blk: '#2a2c31', side: '#14181f', sideHead: '#1c1d21', line: '#34363b', shadow: '0 24px 60px rgba(0,0,0,.55)' },
};
const css = (c) => `
*{box-sizing:border-box;margin:0}body{font:15px system-ui,"Segoe UI",sans-serif;background:${c.bg};color:${c.cap};overflow:hidden}
.cap{position:absolute;left:0;right:0;top:26px;text-align:center;font-size:34px;font-weight:650;letter-spacing:-.4px}
.win{position:absolute;background:${c.win};border-radius:12px;overflow:hidden;box-shadow:${c.shadow};border:1px solid ${c.line};display:flex;flex-direction:column}
.strip{height:36px;background:${c.strip};display:flex;align-items:flex-end;padding:0 12px;gap:6px;flex:none}
.dots{display:flex;gap:7px;align-self:center;margin-right:14px}.dots i{width:11px;height:11px;border-radius:50%;background:#ff5f57}.dots i+i{background:#febc2e}.dots i+i+i{background:#28c840}
.tab{height:28px;padding:6px 14px;border-radius:8px 8px 0 0;font-size:12px;background:${c.bar};color:${c.txt};min-width:150px}.tab.off{background:none;opacity:.6}
.tb{height:40px;background:${c.bar};display:flex;align-items:center;gap:10px;padding:0 12px;flex:none}
.url{flex:1;height:26px;border-radius:13px;background:${c.url};color:${c.txt};opacity:.9;font-size:12px;padding:5px 14px}
.body{flex:1;display:flex;min-height:0}.page{flex:1;background:${c.page};padding:34px 44px;min-width:0}
.page h2{font-size:26px;color:${c.txt};margin-bottom:16px}.ln{height:10px;border-radius:5px;background:${c.blk};margin:11px 0}.hero{height:120px;border-radius:10px;background:${c.blk};margin:18px 0}
.side{width:362px;flex:none;border-left:1px solid ${c.line};background:${c.side};display:flex;flex-direction:column}
.sh{height:32px;background:${c.sideHead};color:${c.txt};font-size:12px;font-weight:600;padding:8px 12px;display:flex;justify-content:space-between;flex:none}
.side img{width:360px;display:block}
`;
const chrome = (c, title) => `<div class="strip"><div class="dots"><i></i><i></i><i></i></div><div class="tab">${title}</div><div class="tab off">New tab</div></div>
<div class="tb"><span style="color:${c.txt};opacity:.5">←  →  ⟳</span><div class="url">example.com/${title === 'Settings' ? 'settings' : 'article'}</div></div>`;
const page = () => `<div class="page"><h2>A quiet morning in the studio</h2><div class="ln" style="width:92%"></div><div class="ln" style="width:84%"></div><div class="ln" style="width:88%"></div><div class="hero"></div><div class="ln" style="width:90%"></div><div class="ln" style="width:70%"></div><div class="ln" style="width:80%"></div></div>`;
const html = (c, inner) => `<style>${css(c)}</style>${inner}`;

// browser window with a web page and the panel docked on the right (panel: real screenshot)
const withPanel = (t, panel, caption) => html(THEMES[t], `<div class="cap">${caption}</div>
<div class="win" style="left:60px;top:100px;width:1160px;height:680px">${chrome(THEMES[t], 'Example article')}
<div class="body">${page()}<div class="side"><div class="sh"><span>Bookmarks</span><span>✕</span></div><img src="${img(panel)}"></div></div></div>`);
// browser window with a real settings screenshot (780 px wide page)
const withSettings = (shot, caption) => html(THEMES.light, `<div class="cap" style="left:0;right:auto;width:380px;top:260px;text-align:left;padding-left:56px;font-size:36px;line-height:1.2">${caption}</div>
<div class="win" style="left:440px;top:48px;width:780px;height:704px">${chrome(THEMES.light, 'Settings')}<div class="body"><img src="${img(shot)}" style="width:780px;height:604px"></div></div>`);

const panelCrop = (n, w, h) => `<div style="width:${w}px;height:${h}px;overflow:hidden;border-radius:12px;box-shadow:0 18px 40px rgba(20,30,60,.3);background:#fff"><img src="${img(n)}" style="width:${w}px;display:block"></div>`;
const tile = html(THEMES.light, `<img src="${icon}" style="position:absolute;left:28px;top:28px;width:56px"><div style="position:absolute;left:28px;top:104px;width:210px;font-size:30px;font-weight:700;line-height:1.15;color:#1d1f23">Bookmarks<br>side panel</div><div style="position:absolute;left:28px;top:200px;width:200px;font-size:14px;color:#4b5060">Keyboard-first, themeable, in your browser's side panel</div><div style="position:absolute;right:26px;top:26px">${panelCrop('panel-light', 170, 228)}</div>`);
const marquee = html(THEMES.light, `<img src="${icon}" style="position:absolute;left:80px;top:96px;width:84px"><div style="position:absolute;left:80px;top:206px;font-size:54px;font-weight:700;letter-spacing:-1px;line-height:1.1;color:#1d1f23">Bookmarks<br>in the side panel</div><div style="position:absolute;left:80px;top:360px;font-size:22px;color:#4b5060">Keyboard-first. Themeable. Private.</div><div style="position:absolute;left:760px;top:51px">${panelCrop('panel-light', 290, 458)}</div><div style="position:absolute;left:1070px;top:51px">${panelCrop('panel-dark', 290, 458)}</div>`);

const JOBS = [
  ['screenshot-1-panel.png', 1280, 800, withPanel('light', 'panel-light', 'Your whole bookmark tree, beside any page')],
  ['screenshot-2-dark.png', 1280, 800, withPanel('dark', 'panel-dark', 'Follows your dark theme')],
  ['screenshot-3-custom-theme.png', 1280, 800, withPanel('light', 'panel-accent', 'Make it yours: colors, font, corners')],
  ['screenshot-4-theme-settings.png', 1280, 800, withSettings('settings-appearance', 'Theme settings with a live preview')],
  ['screenshot-5-hotkeys.png', 1280, 800, withSettings('settings-hotkeys', 'Hotkey presets: Default, Arc, Vim')],
  ['promo-small-440x280.png', 440, 280, tile],
  ['promo-marquee-1400x560.png', 1400, 560, marquee],
];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, width, height, body] of JOBS) {
  const page = await browser.newPage({ viewport: { width, height } });
  const file = path.join(raw, `${name}.html`); // file:// page: setContent cannot load local images
  fs.writeFileSync(file, body);
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => [...document.images].every(i => i.complete));
  await page.screenshot({ path: path.join(out, name) });
  await page.close();
}
await browser.close();
