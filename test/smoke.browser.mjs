// Смоук-тест в настоящем Chromium: собирает архив, загружает распакованное расширение
// и проверяет, что страницы открываются без ошибок, а панель строит дерево и слушается клавиш.
// Прогоны: браузер на каждом языке из _locales/ (каталоги), плюс иврит без перевода (запасной
// английский, слева направо) и иврит с фиктивным переводом справа налево (копия en с dir: rtl —
// только во временной копии архива) для проверки раскладки RTL.
// Нужен Chromium от Playwright (npx playwright install chromium). В npm test не входит:
// запуск — npm run test:browser [-- корень расширения]. Всё временное — во временном каталоге ОС, после проверки удаляется.
// SMOKE_LOCALES=en,ru — только перечисленные прогоны (имена: каталоги _locales, he, he-rtl).
// SMOKE_SCREENSHOTS=<каталог> — сохранить туда снимки страниц каждого прогона (вне репозитория).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { chromium } from 'playwright';
import { DEFAULT_LOCALE, getMessageFor, locales, readMessages } from './i18n-stub.js';
import { isolate } from '../i18n.js';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.argv[2] ?? repo); // что проверяем: по умолчанию этот репозиторий
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'airnook-smoke-'));
const extDir = path.join(tmp, 'ext');
const rtlDir = path.join(tmp, 'ext-rtl'); // то же расширение плюс фиктивный перевод he
const shots = process.env.SMOKE_SCREENSHOTS && path.resolve(process.env.SMOKE_SCREENSHOTS);
// перевод — произвольный текст: в регулярном выражении его символы — буквально
const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Прогон — язык браузера (lang: pt-BR) и каталог сообщений (folder: pt_BR). Язык без каталога
// (he) — запасной английский: locale и dir берутся из сообщений, которые реально показаны.
// he-rtl — фиктивный перевод: locale и dir заданы явно.
const RUNS = [
  ...locales().map(folder => ({ name: folder, lang: folder.replace('_', '-'), folder })),
  { name: 'he', lang: 'he', folder: 'he' },
  { name: 'he-rtl', lang: 'he', folder: 'he', locale: 'he', dir: 'rtl', ext: rtlDir },
];
// Подпись из английского каталога: сравниваем с ней переведённые подписи
const EN = readMessages(DEFAULT_LOCALE);

let total = 0;

async function run({ name, lang, folder, locale, dir, ext = extDir }) {
  // тексты каталога языка; без каталога — запасной en (как в браузере)
  // как t в i18n.js: подстановки изолированы; raw — без изоляции (как метки мест в localizePage)
  const raw = getMessageFor(folder);
  const t = (key, ...subs) => raw(key, subs.map(s => isolate(String(s))));
  const en = getMessageFor(DEFAULT_LOCALE);
  locale ??= t('locale');
  dir ??= t('dir') || 'ltr';
  // как plural в i18n.js: форма числа по правилам языка
  const plural = (key, n) => t(`${key}_${new Intl.PluralRules(locale).select(n)}`, n) || t(`${key}_other`, n);
  const checks = [];
  const check = async (what, fn) => {
    await fn();
    checks.push(what);
    console.log(`ok — ${name}: ${what}`);
  };
  const shot = async (page, what) => {
    if (shots) await page.screenshot({ path: path.join(shots, `${name}-${what}.png`), fullPage: what !== 'panel' });
  };

  // расширения работают только в полном Chromium (channel: 'chromium'), не в headless shell
  const context = await chromium.launchPersistentContext(path.join(tmp, `profile-${name}`), {
    channel: 'chromium',
    headless: true,
    // язык интерфейса: --lang (Windows, macOS) и LANGUAGE (на Linux Chromium берёт его, а флаг не замечает)
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--lang=${lang}`],
    env: { ...process.env, LANGUAGE: folder },
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const url = (page) => `chrome-extension://${id}/${page}`;

    // ошибки страниц: исключения и console.error
    const errors = [];
    const watch = (page, name) => {
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: console.error: ${m.text()}`); });
      return page;
    };
    const open = async (page, viewport = { width: 900, height: 800 }) => {
      const p = watch(await context.newPage(), page);
      await p.setViewportSize(viewport);
      await p.goto(url(page));
      return p;
    };

    // закладки для панели
    const setup = await open('help.html');
    // название «Панели закладок» зависит от языка браузера
    const bar = await setup.evaluate(async () => {
      const work = await chrome.bookmarks.create({ parentId: '1', title: 'Работа' });
      await chrome.bookmarks.create({ parentId: work.id, title: 'Пример', url: 'https://example.com/' });
      await chrome.bookmarks.create({ parentId: work.id, title: '', url: 'https://xn--e1afmkfd.xn--p1ai/%D0%BF%D1%83%D1%82%D1%8C' });
      await chrome.bookmarks.create({ parentId: work.id, title: 'Пустая' });
      await chrome.bookmarks.create({ parentId: '1', title: 'Новости', url: 'https://news.example.org/' });
      return (await chrome.bookmarks.get('1'))[0].title;
    });

    await check('язык браузера применился', async () => {
      const [ui, htmlLang, htmlDir, title] = await setup.evaluate(() =>
        [chrome.i18n.getUILanguage(), document.documentElement.lang, document.documentElement.dir, document.title]);
      assert.equal(ui.split('-')[0], lang.split('-')[0], `язык браузера: ${ui}`);
      assert.equal(htmlLang, locale);
      assert.equal(htmlDir, dir);
      assert.equal(title, t('help_title'));
    });

    await check('справка: таблица команд и версия', async () => {
      await setup.waitForSelector('#keys-table tr');
      assert.ok(await setup.locator('#keys-table tr').count() > 10);
      assert.equal(await setup.locator('#keys-table th').first().textContent(), t('group_nav'));
      const { version } = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
      assert.equal(await setup.locator('#version').textContent(), version);
      await shot(setup, 'help');
    });

    await check('справка: все тексты переведены, клавиши на местах', async () => {
      const empty = await setup.evaluate(() => [...document.querySelectorAll('[data-i18n]')].filter(el => !el.textContent.trim()).map(el => el.dataset.i18n));
      assert.deepEqual(empty, []);
      const text = await setup.locator('main').textContent();
      // текст — из messages.json языка, а не из en (кроме en): подписи без подстановок;
      // если перевод отличается от en — хотя бы одна переведённая подпись должна быть в справке
      const shown = await setup.evaluate(() => [...new Set([...document.querySelectorAll('[data-i18n]')].map(el => el.dataset.i18n))]);
      const plain = shown.filter(k => !EN[k].message.includes('$'));
      const own = plain.filter(k => t(k) !== en(k));
      const sample = own.length ? own : plain;
      assert.ok(sample.some(k => text.includes(t(k))), `справка (${name}): нет подписей из messages.json языка`);
      // клавиши внутри переведённых абзацев подставлены: шаблон data-key / data-chord превратился в kbd
      const bare = await setup.evaluate(() => [...document.querySelectorAll('[data-i18n] [data-key], [data-i18n] [data-chord]')]
        .filter(el => !el.querySelector('kbd') && !el.querySelector('.via')).length);
      assert.equal(bare, 0);
      assert.ok(await setup.locator('[data-i18n] kbd').count() > 50);
      assert.equal(await setup.locator('#start li').count(), 7);
      assert.ok(await setup.locator('#start li kbd').count() >= 6);
      // фраза про стрелки — только в RTL, отдельно от карточек
      assert.equal(await setup.locator('[data-i18n=help_quick_rtl]').isVisible(), dir === 'rtl');
    });

    await check('настройки: тексты, список папок и сочетания', async () => {
      const options = await open('options.html');
      await options.waitForFunction(() => document.querySelectorAll('#root option').length > 1);
      assert.equal(await options.locator('h1').textContent(), t('options_title'));
      assert.equal(await options.locator('#root option').first().textContent(), t('all_bookmarks'));
      assert.ok(await options.locator('#root option', { hasText: 'Работа' }).count() >= 1);
      // текст с вложенными элементами: ссылка на справку — внутри перевода, на своём месте
      const [before, after] = raw('options_intro', ['\0']).split('\0');
      assert.equal(await options.locator('.intro').textContent(), before + t('options_intro_help') + after);
      assert.equal(await options.locator('#keymap h3').first().textContent(), t('group_nav'));
      // новая установка — набор default; открытие панели — своей строкой со ссылкой в настройки Chrome
      assert.equal(await options.locator('[data-preset]').count(), 4);
      assert.equal(await options.locator('[data-preset=default]').getAttribute('aria-pressed'), 'true');
      assert.equal(await options.locator('#keymap .cmd-global .cmd-title').textContent(), t('options_global_title'));
      assert.equal(await options.locator('#keymap .cmd-global .link').textContent(), t('options_global_change'));
      // положение панели: кнопка ведёт в настройки внешнего вида; сторона — если Chrome её отдаёт
      assert.equal(await options.locator('#panel-side-change').textContent(), t('options_panel_side_change'));
      await shot(options, 'options');
      await options.close();
    });

    await check('настройки: смена набора своим окном — Esc отменяет, Enter заменяет', async () => {
      await setup.evaluate(() => chrome.storage.local.set({ keymap: { 'view.cycle': ['x'] } })); // свои сочетания
      const options = await open('options.html');
      await options.waitForFunction(() => document.querySelectorAll('#root option').length > 1);
      const vim = options.locator('[data-preset=vim]');
      assert.equal(await options.locator('#preset-state').textContent(), t('options_custom'));

      await vim.click();
      await options.waitForSelector('#preset-dialog[open]');
      assert.equal(await options.locator('#preset-title').textContent(), t('options_replace_preset', 'Vim'));
      assert.equal(await options.locator('#preset-dialog [value=ok]').textContent(), t('options_replace_ok'));
      assert.equal(await options.locator('#preset-dialog [value=cancel]').textContent(), t('cancel'));
      await shot(options, 'preset');
      await options.keyboard.press('Escape');
      await options.waitForFunction(() => !document.getElementById('preset-dialog').open);
      assert.equal(await options.locator('#preset-state').textContent(), t('options_custom'));
      assert.equal(await options.locator('[data-preset=vim]').getAttribute('aria-pressed'), 'false');
      assert.equal(await options.evaluate(() => document.activeElement.dataset.preset), 'vim');

      await vim.click();
      await options.waitForSelector('#preset-dialog[open]');
      await options.keyboard.press('Enter');
      await options.waitForFunction(() => document.querySelector('[data-preset=vim]').classList.contains('on'));
      assert.equal(await options.locator('[data-preset=vim]').getAttribute('aria-pressed'), 'true');
      assert.equal(await options.locator('#preset-state').textContent(), '');

      // клавиши arc-legacy — для следующих проверок; как после обновления с 2.6.0 — с подсказкой о наборах
      await setup.evaluate(async () => { await chrome.storage.local.remove('firstRun'); await chrome.storage.local.set({ keymap: {}, keysNotice: true }); });
      await options.close();
    });

    await check('настройки: экспорт клавиш в файл, импорт с подтверждением, чужой тип отклоняется', async () => {
      const mine = { 'view.cycle': ['x'] };
      await setup.evaluate((keymap) => chrome.storage.local.set({ preset: 'vim', keymap }), mine);
      const options = await open('options.html');
      await options.waitForFunction(() => document.querySelectorAll('#root option').length > 1);

      const [download] = await Promise.all([options.waitForEvent('download'), options.locator('#export').click()]);
      assert.equal(download.suggestedFilename(), 'bookmarks-hotkeys.json');
      const text = fs.readFileSync(await download.path(), 'utf8');
      const file = JSON.parse(text);
      assert.deepEqual({ ...file, extensionVersion: typeof file.extensionVersion }, {
        app: 'airnook-bookmarks', type: 'hotkeys', format: 1, extensionVersion: 'string', data: { preset: 'vim', keymap: mine },
      });

      // другие клавиши в хранилище; импорт спрашивает и возвращает сохранённые
      await setup.evaluate(() => chrome.storage.local.set({ preset: 'arc-legacy', keymap: {} }));
      const input = options.locator('#import-file');
      await input.setInputFiles({ name: 'bookmarks-hotkeys.json', mimeType: 'application/json', buffer: Buffer.from(text) });
      await options.waitForSelector('#preset-dialog[open]');
      assert.equal(await options.locator('#preset-title').textContent(), t('options_replace_preset', 'bookmarks-hotkeys.json'));
      await options.keyboard.press('Enter');
      await options.waitForFunction(() => !document.getElementById('preset-dialog').open);
      await options.waitForFunction((msg) => document.getElementById('status').textContent === msg, t('options_imported'));
      assert.deepEqual(await setup.evaluate(() => chrome.storage.local.get(['preset', 'keymap'])), { preset: 'vim', keymap: mine });

      // файл темы отклоняется, окна нет, хранилище прежнее
      const theme = { ...file, type: 'theme' };
      await input.setInputFiles({ name: 'bookmarks-theme.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(theme)) });
      await options.waitForFunction((msg) => document.getElementById('status').textContent === msg, t('options_import_wrong_type'));
      assert.equal(await options.evaluate(() => document.getElementById('preset-dialog').open), false);
      assert.deepEqual(await setup.evaluate(() => chrome.storage.local.get(['preset', 'keymap'])), { preset: 'vim', keymap: mine });

      await setup.evaluate(() => chrome.storage.local.set({ keymap: {} })); // как после прошлой проверки
      await options.close();
    });

    const panel = await open('panel.html', { width: 360, height: 560 });
    const rowTexts = () => panel.locator('#list li').allTextContents();
    const cur = () => panel.locator('#list li.cur').textContent();
    const toast = async (text) => panel.waitForFunction(
      (t) => document.getElementById('toast').textContent.includes(t), text);

    await check('панель: дерево закладок, шапка с «Отменить»/«Повторить» (неактивны), список сразу под ней', async () => {
      await panel.waitForFunction(() => [...document.querySelectorAll('#list li')].some(li => li.textContent === 'Работа'));
      const rows = await rowTexts();
      for (const t of [bar, 'Работа', 'Новости']) assert.ok(rows.includes(t), `${t} в ${rows}`);
      assert.equal(await panel.evaluate(() => document.activeElement.id), 'list');
      assert.equal(await panel.locator('#search').getAttribute('placeholder'), t('search_placeholder'));
      assert.equal(await panel.locator('header, #title, #find').count(), 0);
      assert.equal(await panel.locator('#search-bar').isVisible(), false);
      const header = await panel.locator('#bar').boundingBox();
      const first = await panel.locator('#list li').first().boundingBox();
      assert.ok(header.y < 12 && first.y >= header.y + header.height && first.y < header.y + header.height + 12, `шапка ${JSON.stringify(header)}, список ${first.y}`);
      for (const id of ['undo', 'redo']) {
        const b = panel.locator(`#bar [data-cmd=${id}]`);
        assert.equal(await b.isDisabled(), true, id);
        assert.match(await b.getAttribute('title'), new RegExp(`^${literal(t('cmd_' + id))}`));
        assert.equal(await b.getAttribute('aria-label'), await b.getAttribute('title'));
      }
    });

    await check('панель: после обновления — один раз подсказка о наборах клавиш', async () => {
      await toast(t('keys_notice'));
      await panel.waitForFunction(async () => !('keysNotice' in await chrome.storage.local.get('keysNotice')));
    });

    // в RTL ← раскрывает папку, → сворачивает (стрелки зеркалятся)
    const [expand, collapse] = dir === 'rtl' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
    await check('панель: стрелки и раскрытие папки', async () => {
      assert.equal(await cur(), bar);
      await panel.keyboard.press('ArrowDown');
      assert.equal(await cur(), 'Работа');
      await panel.keyboard.press(expand);
      await panel.waitForFunction(() => document.querySelectorAll('#list li').length >= 6);
      await panel.keyboard.press('ArrowDown');
      assert.equal(await cur(), 'Пример');
      await panel.keyboard.press('ArrowDown');
      assert.equal(await cur(), 'пример.рф'); // без названия — сайт, кириллицей
      await panel.keyboard.press('ArrowDown');
      await panel.keyboard.press(expand); // пустая папка раскрыта — подпись «пусто»
      await panel.waitForFunction(() => document.querySelector('#list li.cur[aria-expanded="true"]'));
      assert.equal(await panel.locator('#list li.cur').evaluate(li => getComputedStyle(li, '::after').content), `"${t('folder_empty')}"`);
      await panel.keyboard.press('Space'); // отмеченная строка — с полосой в начале
      await shot(panel, 'panel');
      // отступ дерева и иконка — в начале строки: слева, а справа налево — справа
      const box = await panel.locator('#list li.cur').boundingBox();
      const icon = await panel.locator('#list li.cur i').boundingBox();
      assert.equal(icon.x > box.x + box.width / 2, dir === 'rtl', `иконка: ${icon.x} в ${box.x}…${box.x + box.width}`);
      const pad = await panel.locator('#list li.cur').evaluate(li => [getComputedStyle(li).paddingLeft, getComputedStyle(li).paddingRight]);
      assert.equal(pad[dir === 'rtl' ? 1 : 0], '32px'); // 4 + 2 уровня × 14
      await panel.keyboard.press('Escape'); // снять отметку
      await panel.keyboard.press(collapse); // свернуть пустую
      await panel.keyboard.press('ArrowUp');
      await panel.keyboard.press(collapse); // на закладке — к её папке
      assert.equal(await cur(), 'Работа');
      await panel.keyboard.press(collapse); // свернуть
      await panel.waitForFunction(() => !document.querySelector('#list li.cur[aria-expanded="true"]'));
      await panel.keyboard.press('ArrowDown');
      assert.equal(await cur(), 'Новости');
    });

    await check('панель: Пробел отмечает, на системной папке объясняет', async () => {
      await panel.keyboard.press('Space');
      assert.equal(await panel.locator('#list li.cur').getAttribute('aria-selected'), 'true');
      assert.ok((await panel.locator('#marks').textContent()).startsWith(t('marked', 1)));
      await panel.keyboard.press('Escape'); // снять отметки
      assert.equal(await panel.locator('#list li.cur').getAttribute('aria-selected'), 'false');
      await panel.keyboard.press('Home');
      assert.equal(await cur(), bar);
      await panel.keyboard.press('Space');
      await toast(t('locked_system_mark'));
    });

    await check('панель: переименование и удаление системной папки — причина, ничего не открывается', async () => {
      await panel.evaluate(() => { document.getElementById('toast').textContent = ''; });
      await panel.keyboard.press('r');
      await toast(t('locked_system_edit'));
      assert.equal(await panel.locator('#list input.rename').count(), 0);
      await panel.evaluate(() => { document.getElementById('toast').textContent = ''; });
      await panel.keyboard.press('d');
      await panel.keyboard.press('d'); // «d d» — удаление
      await toast(t('locked_system_edit'));
      assert.equal(await panel.locator('dialog[open]').count(), 0);
      assert.equal(await cur(), bar);
    });

    await check('панель: Alt+↓ на системной папке — причина один раз, при удержании тихо, ничего не переезжает', async () => {
      assert.equal(await cur(), bar);
      const before = await rowTexts();
      // считаем записи в тост: каждый показ причины — это запись (textContent), повтора не должно быть
      await panel.evaluate(() => {
        const toastEl = document.getElementById('toast');
        toastEl.textContent = '';
        window.toastWrites = 0;
        new MutationObserver(() => window.toastWrites++).observe(toastEl, { childList: true, characterData: true, subtree: true });
      });
      await panel.keyboard.press('Alt+ArrowDown');
      await toast(t('locked_system_edit'));
      const shown = await panel.evaluate(() => window.toastWrites);
      assert.ok(shown > 0);
      // удержание: повторные keydown с repeat, без ожидания между ними
      await panel.evaluate(() => {
        for (let i = 0; i < 5; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', altKey: true, repeat: true, bubbles: true }));
      });
      await panel.waitForTimeout(300); // даём шагам повтора дойти до проверки (они асинхронные)
      assert.equal(await panel.evaluate(() => window.toastWrites), shown);
      assert.deepEqual(await rowTexts(), before);
      assert.equal(await cur(), bar);
    });

    await check('панель: поиск по «/», кириллический домен, Esc', async () => {
      await panel.keyboard.press('/');
      assert.equal(await panel.locator('#search-bar').isVisible(), true);
      assert.equal(await panel.evaluate(() => document.activeElement.id), 'search');
      await panel.keyboard.type('пример.рф');
      await panel.waitForFunction(() => document.querySelector('#list li.hit mark'));
      const hits = await panel.locator('#list li.hit').allTextContents();
      assert.equal(hits.length, 1, String(hits));
      assert.match(hits[0], /пример\.рф\/путь/);
      await panel.keyboard.press('Escape');
      assert.equal(await panel.locator('#search-bar').isVisible(), false);
      assert.equal(await cur(), bar); // курсор — где был до поиска
    });

    await check('панель: счётчик найденного в строке поиска — виден, пуст без запроса, с своей стороны, не перекрывает', async () => {
      await panel.keyboard.press('/');
      const found = panel.locator('#found');
      const field = panel.locator('#search');
      assert.equal(await found.isVisible(), false); // пустой запрос — счётчик скрыт
      await panel.keyboard.type('пример.рф');
      await panel.waitForFunction(() => document.querySelector('#found')?.textContent.includes('1'));
      assert.equal(await found.textContent(), t('search_found', 1));
      assert.equal(await found.getAttribute('aria-hidden'), 'true');
      assert.equal(await found.isVisible(), true);
      const [count, input] = await Promise.all([found.boundingBox(), field.boundingBox()]);
      // счётчик — справа (в RTL — слева) от поля, а текст поля до него не доходит
      assert.equal(count.x > input.x + input.width / 2, dir !== 'rtl', `счётчик ${count.x} в поле ${input.x}…${input.x + input.width}`);
      if (dir === 'rtl') assert.ok(count.x + count.width <= input.x + 1, 'счётчик не перекрывает поле');
      else assert.ok(input.x + input.width <= count.x + 1, 'счётчик не перекрывает поле');
      await field.fill('');
      assert.equal(await found.isVisible(), false); // стёрли запрос — счётчик скрыт
      await panel.keyboard.press('Escape');
    });

    await check('панель: палитра по Mod+k, поиск по словам языка и английским', async () => {
      const own = t('cmd_view_cycle_words').split(' ')[0];
      for (const query of ['view', ...(own ? [own] : [])]) {
        await panel.keyboard.press('Control+k');
        await panel.waitForSelector('#palette[open]');
        assert.equal(await panel.locator('#palette-input').getAttribute('placeholder'), t('palette_placeholder'));
        await panel.keyboard.type(query);
        assert.match(await panel.locator('#palette-list li[aria-selected]').textContent(), new RegExp(literal(t('cmd_view_cycle'))), query);
        await panel.keyboard.press('Escape');
      }
      // «Раскрыть папку» в палитре: ← в RTL (та же клавиша, что и раскрывает папку), иначе →
      await panel.keyboard.press('Control+k');
      await panel.keyboard.type('expand');
      assert.equal(await panel.locator('#palette-list li[aria-selected] kbd').first().textContent(), dir === 'rtl' ? '←' : '→');
      await panel.keyboard.press('Escape');
      await panel.keyboard.press('Control+k');
      await panel.keyboard.type('view');
      await panel.keyboard.press('Enter');
      await toast(t('view_changed', t('view_detailed')));
      assert.equal(await panel.locator('#palette[open]').count(), 0);
      await panel.waitForFunction(() => document.getElementById('list').dataset.view === 'detailed');
      // по кругу — обратно к обычному двумя нажатиями подряд, без ожидания между ними.
      // оба keydown — в одном вызове страницы: настоящие нажатия Playwright разнесены во времени
      await panel.evaluate(() => {
        for (let i = 0; i < 2; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true }));
      });
      await panel.waitForFunction(() => document.getElementById('list').dataset.view === 'normal');
    });

    await check('панель: новая папка — Esc отменяет создание', async () => {
      const before = await rowTexts();
      await panel.keyboard.press('n');
      await panel.waitForSelector('#list input.rename');
      await panel.keyboard.press('Escape');
      await panel.waitForFunction((n) => document.querySelectorAll('#list li').length === n && !document.querySelector('.rename'), before.length);
      assert.deepEqual(await rowTexts(), before);
    });

    await check('панель: удаление спрашивает, Esc — отмена', async () => {
      await panel.keyboard.press('End');
      assert.equal(await cur(), 'Новости');
      await panel.keyboard.press('d');
      await panel.waitForSelector('#confirm[open]');
      assert.equal(await panel.locator('#confirm-title').textContent(), t('delete_bookmark', 'Новости'));
      assert.equal(await panel.locator('#confirm [value=cancel]').textContent(), t('cancel'));
      await shot(panel, 'confirm');
      await panel.keyboard.press('Escape');
      assert.equal(await panel.locator('#confirm[open]').count(), 0);
      assert.ok((await rowTexts()).includes('Новости'));
    });

    // латиница в другом направлении: в RTL-фразе имя — целиком, в изоляции (D2)
    await check('панель: папка с латинским именем — в окне удаления и тосте «Перемещено», в изоляции', async () => {
      await setup.evaluate(() => chrome.bookmarks.create({ parentId: '1', title: 'Empty folder' }));
      await panel.waitForFunction(() => [...document.querySelectorAll('#list li')].some(li => li.textContent === 'Empty folder'));
      await panel.keyboard.press('End');
      assert.equal(await cur(), 'Empty folder');
      await panel.keyboard.press('d');
      await panel.waitForSelector('#confirm[open]');
      const title = await panel.locator('#confirm-title').textContent();
      assert.equal(title, t('delete_folder', 'Empty folder'));
      assert.ok(title.includes(isolate('Empty folder')), title);
      await shot(panel, 'confirm-folder');
      await panel.keyboard.press('Escape');
      await panel.waitForFunction(() => !document.querySelector('#confirm[open]'));
      // «Новости» — в эту папку: тост называет её
      await panel.keyboard.press('ArrowUp');
      assert.equal(await cur(), 'Новости');
      await panel.keyboard.press('m');
      await panel.waitForSelector('#palette[open]');
      await panel.keyboard.type('Empty folder');
      await panel.keyboard.press('Enter');
      await toast(t('moved', 'Empty folder'));
      await shot(panel, 'moved');
    });

    // Отмена и повтор. Дерево «Панели закладок» без id: [название, адрес, [дети]]
    const shape = () => setup.evaluate(async () => {
      const strip = (n) => [n.title, n.url ?? null, ...(n.children ? [n.children.map(strip)] : [])];
      return strip((await chrome.bookmarks.getSubTree('1'))[0]);
    });
    const goTo = async (text) => {
      await panel.keyboard.press('Home');
      for (let i = 0; i < 30 && await cur() !== text; i++) await panel.keyboard.press('ArrowDown');
      assert.equal(await cur(), text);
    };
    const hasRow = (text, yes = true) => panel.waitForFunction(([text, yes]) =>
      [...document.querySelectorAll('#list li')].some(li => li.textContent === text) === yes, [text, yes]);
    const deleteWork = async () => {
      await goTo('Работа');
      await panel.keyboard.press('d');
      await panel.waitForSelector('#confirm[open]');
      await panel.locator('#confirm [value=ok]').click(); // непустую папку одним Enter не удалить
      await toast(t('undo_deleted', 'Работа'));
      await hasRow('Работа', false);
    };

    await check('панель: удалить папку с содержимым → Ctrl+Z — всё на месте, курсор на ней', async () => {
      const before = await shape();
      await deleteWork();
      assert.equal(await panel.locator('#toast.show button').textContent(), t('undo_button'));
      await shot(panel, 'undo-toast');
      await panel.keyboard.press('Control+z');
      await toast(t('undone', t('undo_deleted', 'Работа')));
      await hasRow('Работа');
      assert.deepEqual(await shape(), before);
      assert.equal(await cur(), 'Работа');
    });

    await check('панель: переименовать → отменить → повторить (Ctrl+Shift+Z и Ctrl+Y)', async () => {
      await goTo('Работа');
      await panel.keyboard.press('r');
      await panel.locator('#list input.rename').fill('Work 2');
      await panel.keyboard.press('Enter');
      await toast(t('undo_renamed', 'Work 2'));
      await hasRow('Work 2');
      for (const [key, shown] of [['Control+z', 'Работа'], ['Control+Shift+z', 'Work 2'], ['Control+z', 'Работа'], ['Control+y', 'Work 2'], ['Control+z', 'Работа']]) {
        await panel.keyboard.press(key);
        await hasRow(shown);
        assert.equal(await cur(), shown, key);
      }
      await toast(t('undone', t('undo_renamed', 'Work 2')));
    });

    await check('панель: кнопки в шапке — после правки «Отменить» активна, клик отменяет, затем активна «Повторить»', async () => {
      const undo = panel.locator('#bar [data-cmd=undo]');
      const redo = panel.locator('#bar [data-cmd=redo]');
      await goTo('Работа');
      await panel.keyboard.press('r');
      await panel.locator('#list input.rename').fill('Work 4');
      await panel.keyboard.press('Enter');
      await hasRow('Work 4');
      await panel.waitForFunction(() => !document.querySelector('#bar [data-cmd=undo]').disabled);
      assert.equal(await redo.isDisabled(), true);
      assert.match(await undo.getAttribute('title'), /\(.+\)$/);
      await undo.click();
      await hasRow('Работа');
      await panel.waitForFunction(() => !document.querySelector('#bar [data-cmd=redo]').disabled);
      assert.equal(await panel.evaluate(() => document.activeElement.id), 'list');
      await redo.click();
      await hasRow('Work 4');
      await panel.keyboard.press('Control+z');
      await hasRow('Работа');
    });

    await check('панель: Alt+↓ → Ctrl+Z — порядок как был', async () => {
      const before = await shape();
      await goTo('Работа');
      await panel.keyboard.press('Alt+ArrowDown');
      await toast(t('undo_moved', 'Работа'));
      assert.notDeepEqual(await shape(), before);
      await panel.keyboard.press('Control+z');
      await toast(t('undone', t('undo_moved', 'Работа')));
      assert.deepEqual(await shape(), before);
      assert.equal(await cur(), 'Работа');
    });

    await check('панель: кнопка «Отменить» в сообщении нажимается мышью', async () => {
      const before = await shape();
      await deleteWork();
      const button = panel.locator('#toast.show button');
      assert.equal(await button.getAttribute('aria-label'), t('undo_button_label', t('undo_deleted', 'Работа')));
      await button.click();
      await toast(t('undone', t('undo_deleted', 'Работа')));
      await hasRow('Работа');
      assert.deepEqual(await shape(), before);
      assert.equal(await panel.evaluate(() => document.activeElement.id), 'list');
    });

    await check('панель: Ctrl+Z в строке поиска — отмена текста, закладки не трогает', async () => {
      await goTo('Работа');
      await panel.keyboard.press('r');
      await panel.locator('#list input.rename').fill('Work 3');
      await panel.keyboard.press('Enter');
      await hasRow('Work 3');
      const before = await shape();
      await panel.keyboard.press('/');
      await panel.keyboard.type('abc');
      await panel.keyboard.press('Control+z');
      await panel.waitForTimeout(300);
      assert.equal(await panel.evaluate(() => document.activeElement.id), 'search');
      assert.deepEqual(await shape(), before);
      await panel.keyboard.press('Escape');
      await panel.keyboard.press('Control+z'); // в списке — отменяет переименование
      await hasRow('Работа');
    });

    // Перетаскивание мышью: своя папка «Drag» — d1, d2, d3, Box (b1)
    const dragFolder = await setup.evaluate(async () => {
      const f = await chrome.bookmarks.create({ parentId: '1', title: 'Drag' });
      for (const n of ['d1', 'd2', 'd3']) await chrome.bookmarks.create({ parentId: f.id, title: n, url: `https://${n}.example/` });
      const box = await chrome.bookmarks.create({ parentId: f.id, title: 'Box' });
      await chrome.bookmarks.create({ parentId: box.id, title: 'b1', url: 'https://b1.example/' });
      return f.id;
    });
    const order = (id = dragFolder) => setup.evaluate(async (id) => (await chrome.bookmarks.getChildren(id)).map(n => n.title), id);
    const boxId = async () => setup.evaluate(async (id) => (await chrome.bookmarks.getChildren(id)).find(n => n.title === 'Box').id, dragFolder);
    const row = (text) => panel.locator('#list li[data-i]').filter({ hasText: new RegExp(`^${literal(text)}$`) });
    // нажать на строке from, провести с промежуточными шагами до доли part высоты строки to; release — отпустить
    const drag = async (from, to, part = 0.5, release = true) => {
      const a = await row(from).boundingBox();
      const b = await row(to).boundingBox();
      const [x, y0, y1] = [a.x + a.width / 2, a.y + a.height / 2, b.y + b.height * part];
      await panel.mouse.move(x, y0);
      await panel.mouse.down();
      for (let k = 1; k <= 8; k++) await panel.mouse.move(x, y0 + (y1 - y0) * k / 8);
      if (release) await panel.mouse.up();
    };
    // снимок в светлой и тёмной теме (только с SMOKE_SCREENSHOTS)
    const shotThemes = async (what) => {
      if (!shots) return;
      await shot(panel, what);
      await panel.emulateMedia({ colorScheme: 'dark' });
      await shot(panel, `${what}-dark`);
      await panel.emulateMedia({ colorScheme: null });
    };
    const noDrop = async () => {
      assert.equal(await panel.locator('#list .drop-line, #list .drop-into, #drag-label').count(), 0);
      assert.equal(await panel.evaluate(() => document.documentElement.classList.contains('dragging')), false);
    };

    await check('перетаскивание: закладка вниз через две строки, линия с начала строки, Ctrl+Z возвращает', async () => {
      await hasRow('Drag');
      await goTo('Drag');
      await panel.keyboard.press(expand);
      await hasRow('d1');
      await drag('d1', 'd3', 0.9, false);
      assert.equal(await panel.locator('#drag-label').textContent(), 'd1');
      const line = await panel.locator('#list li .drop-line.after').boundingBox();
      const box = await panel.locator('#list li:has(> .drop-line)').boundingBox();
      assert.equal(await panel.locator('#list li:has(> .drop-line)').textContent(), 'd3');
      // отступ уровня — в начале строки: слева, справа налево — справа
      const [start, end] = [line.x - box.x, box.x + box.width - (line.x + line.width)];
      assert.equal(start > end, dir !== 'rtl', `линия: ${start} от левого края, ${end} от правого`);
      await shotThemes('drag-line');
      await panel.mouse.up();
      await toast(t('undo_moved', 'd1'));
      assert.deepEqual(await order(), ['d2', 'd3', 'd1', 'Box']);
      assert.equal(await cur(), 'd1');
      await noDrop();
      await panel.keyboard.press('Control+z');
      await toast(t('undone', t('undo_moved', 'd1')));
      assert.deepEqual(await order(), ['d1', 'd2', 'd3', 'Box']);
    });

    await check('перетаскивание: список перерисовался под неподвижным указателем — линия переходит на строку под ним', async () => {
      await drag('d1', 'd3', 0.9, false);
      await panel.waitForSelector('#list li:has(> .drop-line)');
      const zz = await setup.evaluate(async (id) => (await chrome.bookmarks.create({ parentId: id, index: 0, title: 'zz', url: 'https://zz.example/' })).id, dragFolder);
      await hasRow('zz'); // чтение дерева по событию сдвинуло строки вниз
      await panel.waitForFunction(() => document.querySelector('#list li:has(> .drop-line)')?.textContent === 'd2');
      await panel.keyboard.press('Escape');
      await panel.mouse.up();
      await setup.evaluate((id) => chrome.bookmarks.remove(id), zz);
      await panel.waitForFunction(() => ![...document.querySelectorAll('#list li')].some(li => li.textContent === 'zz'));
    });

    await check('перетаскивание: в середину свёрнутой папки — в её конец, папка раскрыта', async () => {
      assert.equal(await row('Box').getAttribute('aria-expanded'), 'false');
      await drag('d2', 'Box', 0.5, false);
      assert.equal(await panel.locator('#list li.drop-into').textContent(), 'Box');
      await shotThemes('drag-into');
      await panel.mouse.up();
      await toast(t('undo_moved', 'd2'));
      assert.deepEqual(await order(await boxId()), ['b1', 'd2']);
      assert.equal(await row('Box').getAttribute('aria-expanded'), 'true');
      assert.equal(await cur(), 'd2');
      await panel.keyboard.press('Control+z');
      await toast(t('undone', t('undo_moved', 'd2')));
      assert.deepEqual(await order(), ['d1', 'd2', 'd3', 'Box']);
    });

    await check('перетаскивание: клик со сдвигом меньше порога — обычный клик', async () => {
      const b = await row('Box').boundingBox();
      await panel.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await panel.mouse.down();
      await panel.mouse.move(b.x + b.width / 2 + 2, b.y + b.height / 2 + 2);
      await panel.mouse.up();
      await panel.waitForFunction(() => [...document.querySelectorAll('#list li')].some(li => li.textContent === 'Box' && li.ariaExpanded === 'false'));
      assert.equal(await cur(), 'Box');
      await noDrop();
    });

    await check('перетаскивание: свёрнутая папка раскрывается при наведении, Esc — ничего не меняется', async () => {
      const shown = await panel.locator('#toast').textContent();
      await drag('d1', 'Box', 0.5, false);
      await panel.waitForFunction(() => [...document.querySelectorAll('#list li')].some(li => li.textContent === 'Box' && li.ariaExpanded === 'true'));
      await panel.keyboard.press('Escape');
      await noDrop();
      await panel.mouse.up();
      await panel.waitForTimeout(200);
      assert.deepEqual(await order(), ['d1', 'd2', 'd3', 'Box']);
      assert.deepEqual(await order(await boxId()), ['b1']);
      assert.equal(await panel.locator('#toast').textContent(), shown);
    });

    await check('перетаскивание: группа отмеченных — одним блоком, отметки сняты, Ctrl+Z', async () => {
      await goTo('d1');
      await panel.keyboard.press('Space');
      await goTo('d3');
      await panel.keyboard.press('Space');
      await drag('d3', 'd2', 0.1, false);
      assert.equal(await panel.locator('#drag-label').textContent(), plural('drag_items', 2));
      await shotThemes('drag-group');
      await panel.mouse.up();
      await toast(plural('undo_moved_items', 2));
      assert.deepEqual(await order(), ['d1', 'd3', 'd2', 'Box']);
      assert.equal(await panel.locator('#list li[aria-selected="true"]').count(), 0);
      await panel.keyboard.press('Control+z');
      await toast(t('undone', plural('undo_moved_items', 2)));
      assert.deepEqual(await order(), ['d1', 'd2', 'd3', 'Box']);
    });

    await check('перетаскивание: системную папку не тащит', async () => {
      const before = await rowTexts();
      const expanded = await row(bar).getAttribute('aria-expanded');
      await drag(bar, 'd2', 0.5, false);
      assert.equal(await panel.locator('#list.no-drag').count(), 1);
      await noDrop();
      await panel.mouse.up();
      await panel.waitForTimeout(200);
      assert.equal(await panel.locator('#list.no-drag').count(), 0);
      assert.equal(await row(bar).getAttribute('aria-expanded'), expanded); // и клик не прошёл
      assert.deepEqual(await rowTexts(), before);
    });

    // Меню правой кнопкой: своя папка «Menu» — m1, mf (m2)
    const menuFolder = await setup.evaluate(async () => {
      const f = await chrome.bookmarks.create({ parentId: '1', title: 'Menu' });
      await chrome.bookmarks.create({ parentId: f.id, title: 'm1', url: 'https://m1.example/' });
      const sub = await chrome.bookmarks.create({ parentId: f.id, title: 'mf' });
      await chrome.bookmarks.create({ parentId: sub.id, title: 'm2', url: 'https://m2.example/' });
      return f.id;
    });
    const tree = (id = menuFolder) => setup.evaluate(async (id) => {
      const strip = (n) => [n.title, n.url ?? null, ...(n.children ? [n.children.map(strip)] : [])];
      return strip((await chrome.bookmarks.getSubTree(id))[0]);
    }, id);
    const one = (text) => row(text).first();
    const menuShown = () => panel.waitForSelector('#menu:not([hidden])');
    const menuGone = () => panel.waitForSelector('#menu[hidden]', { state: 'attached' });
    const rightClick = async (text) => { await one(text).click({ button: 'right' }); await menuShown(); };
    const item = (text) => panel.locator('#menu [role="menuitem"]').filter({ has: panel.locator('.label', { hasText: new RegExp(`^${literal(text)}$`) }) });
    const labels = () => panel.locator('#menu [role="menuitem"] .label').allTextContents();
    const inPanel = async () => {
      const box = await panel.locator('#menu').boundingBox();
      const view = panel.viewportSize();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width && box.y + box.height <= view.height, `меню ${JSON.stringify(box)}`);
    };

    await check('меню: правый клик по закладке — пункты на языке прогона, в пределах панели, RTL зеркально', async () => {
      await goTo('Drag');
      await panel.keyboard.press(collapse);
      await hasRow('Menu');
      await goTo('Menu');
      await panel.keyboard.press(expand);
      await hasRow('m1');
      await rightClick('m1');
      assert.equal(await cur(), 'm1');
      const shown = await labels();
      const want = [t('menu_open_new_tab'), t('menu_open_new_window'), t('menu_open_incognito'), t('menu_edit'), t('cmd_cut'), t('cmd_copy'), t('cmd_paste'),
        t('menu_delete'), t('menu_add_page'), t('menu_add_folder'), t('menu_manager')];
      assert.deepEqual(shown.filter(s => want.includes(s)), want, String(shown));
      assert.equal(shown.length, want.length + 2 + (shown.includes(t('menu_open_split')) ? 1 : 0)); // + отменить, повторить
      assert.equal(await panel.locator('#menu [role="separator"]').count(), 6);
      assert.equal(await panel.locator('#menu').getAttribute('role'), 'menu');
      assert.equal(await item(t('cmd_paste')).getAttribute('aria-disabled'), 'true'); // буфер пуст
      assert.equal(await item(t('cmd_paste')).getAttribute('title'), t('paste_empty'));
      assert.equal(await item(t('menu_open_incognito')).getAttribute('aria-disabled'), 'true'); // инкогнито не разрешён
      assert.equal(await item(t('menu_open_incognito')).getAttribute('title'), t('menu_incognito_off'));
      // клавиша команды — серым в конце пункта: справа, справа налево — слева
      assert.deepEqual(await item(t('cmd_cut')).locator('kbd').allTextContents(), ['Ctrl', 'X']);
      const [label, keys] = await Promise.all([item(t('cmd_cut')).locator('.label').boundingBox(), item(t('cmd_cut')).locator('.keys').boundingBox()]);
      assert.equal(keys.x < label.x, dir === 'rtl', `клавиши ${keys.x}, название ${label.x}`);
      await inPanel();
      await shotThemes('menu-bookmark');
      await panel.keyboard.press('Escape');
      await menuGone();
      assert.equal(await panel.evaluate(() => document.activeElement.id), 'list');
      // у края панели меню переворачивается и остаётся в её пределах
      const b = await one('m1').boundingBox();
      await panel.mouse.click(dir === 'rtl' ? b.x + 4 : b.x + b.width - 4, b.y + b.height / 2, { button: 'right' });
      await menuShown();
      await inPanel();
      await panel.mouse.click(5, 5); // клик мимо закрывает меню и ничего не открывает
      await menuGone();
      assert.equal(await cur(), 'm1');
    });

    await check('меню: «Изменить» меняет название и адрес, Ctrl+Z отменяет', async () => {
      await rightClick('m1');
      await item(t('menu_edit')).click();
      await panel.waitForSelector('#edit[open]');
      assert.equal(await panel.locator('#edit-title').textContent(), t('edit_bookmark'));
      assert.equal(await panel.locator('#edit-name').inputValue(), 'm1');
      assert.equal(await panel.locator('#edit-url').inputValue(), 'https://m1.example/');
      await panel.locator('#edit-name').fill('m1 new');
      await panel.locator('#edit-url').fill('m1new.example');
      await panel.keyboard.press('Enter');
      await toast(t('undo_edited', 'm1 new'));
      assert.deepEqual((await tree())[2][0], ['m1 new', 'https://m1new.example/']);
      assert.equal(await cur(), 'm1 new');
      await panel.keyboard.press('Control+z');
      await toast(t('undone', t('undo_edited', 'm1 new')));
      assert.deepEqual((await tree())[2][0], ['m1', 'https://m1.example/']);
      // папка — только название; Esc — ничего не меняет
      await rightClick('mf');
      assert.ok((await labels()).includes(t('menu_rename')));
      assert.ok((await labels()).includes(t('menu_open_all', 1)));
      await shotThemes('menu-folder');
      await item(t('menu_rename')).click();
      await panel.waitForSelector('#edit[open]');
      assert.equal(await panel.locator('#edit-url').isVisible(), false);
      await panel.keyboard.press('Escape');
      await panel.waitForFunction(() => !document.getElementById('edit').open);
      assert.equal((await tree())[2][1][0], 'mf');
    });

    await check('меню: копировать папку с содержимым → вставить — копия; Ctrl+Z убирает', async () => {
      const before = await tree();
      await rightClick('mf');
      await item(t('cmd_copy')).click();
      await toast(t('clip_copied', 1));
      await rightClick('m1');
      assert.equal(await item(t('cmd_paste')).getAttribute('aria-disabled'), null);
      await item(t('cmd_paste')).click();
      await toast(t('undo_pasted', 1));
      const after = await tree();
      assert.deepEqual(after[2].map(n => n[0]), ['m1', 'mf', 'mf']);
      assert.deepEqual(after[2][1], before[2][1]); // со всем содержимым
      await panel.keyboard.press('Control+z');
      await toast(t('undone', t('undo_pasted', 1)));
      assert.deepEqual(await tree(), before);
    });

    await check('меню: вырезать → вставить — перенос, отмена возвращает', async () => {
      const before = await tree();
      await rightClick('m1');
      await item(t('cmd_cut')).click();
      await toast(t('clip_cut', 1));
      await rightClick('mf');
      await item(t('cmd_paste')).click();
      await toast(t('undo_moved', 'm1'));
      assert.deepEqual((await tree())[2].map(n => n[0]), ['mf', 'm1']);
      assert.equal(await cur(), 'm1');
      await rightClick('m1'); // буфер после вставки вырезанного пуст
      assert.equal(await item(t('cmd_paste')).getAttribute('aria-disabled'), 'true');
      await panel.keyboard.press('Escape');
      await panel.keyboard.press('Control+z');
      await toast(t('undone', t('undo_moved', 'm1')));
      assert.deepEqual(await tree(), before);
    });

    await check('меню: «Удалить» — с подтверждением, Ctrl+Z возвращает', async () => {
      const before = await tree();
      await rightClick('m1');
      await item(t('menu_delete')).click();
      await panel.waitForSelector('#confirm[open]');
      assert.equal(await panel.locator('#confirm-title').textContent(), t('delete_bookmark', 'm1'));
      await panel.locator('#confirm [value=ok]').click();
      await toast(t('undo_deleted', 'm1'));
      await hasRow('m1', false);
      await panel.keyboard.press('Control+z');
      await hasRow('m1');
      assert.deepEqual(await tree(), before);
    });

    await check('меню на пустом месте: поиск, палитра, настройки; строка поиска появляется и исчезает', async () => {
      const view = panel.viewportSize();
      const last = await panel.locator('#list li').last().boundingBox();
      assert.ok(last.y + last.height < view.height - 40, 'под списком есть пустое место');
      await panel.mouse.click(view.width / 2, view.height - 20, { button: 'right' });
      await menuShown();
      assert.deepEqual(await labels(), [t('cmd_paste'), t('menu_add_page'), t('menu_add_folder'), t('menu_manager'),
        t('cmd_search'), t('cmd_palette'), t('cmd_settings'), ...(await labels()).slice(-2)]);
      await inPanel();
      await shotThemes('menu-empty');
      await item(t('cmd_search')).click();
      await menuGone();
      assert.equal(await panel.locator('#search-bar').isVisible(), true);
      assert.equal(await panel.evaluate(() => document.activeElement.id), 'search');
      await panel.keyboard.press('Escape');
      assert.equal(await panel.locator('#search-bar').isVisible(), false);
      await panel.mouse.click(view.width / 2, view.height - 20, { button: 'right' });
      await menuShown();
      await item(t('cmd_palette')).click();
      await panel.waitForSelector('#palette[open]');
      await panel.keyboard.press('Escape');
      await panel.waitForFunction(() => !document.getElementById('palette').open);
    });

    await check('полоса «Выбрано» внизу — только при отметках, сообщение над ней', async () => {
      assert.equal(await panel.locator('#marks').isVisible(), false);
      await goTo('m1');
      await panel.keyboard.press('Space');
      assert.equal(await panel.locator('#marks').textContent(), t('marked_clear', 1, 'Esc'));
      const bar = await panel.locator('#marks').boundingBox();
      assert.equal(Math.round(bar.y + bar.height), panel.viewportSize().height);
      await panel.keyboard.press('c'); // любое сообщение
      await panel.waitForSelector('#toast.show');
      const msg = await panel.locator('#toast').boundingBox();
      assert.ok(msg.y + msg.height <= bar.y, `сообщение ${msg.y + msg.height}, полоса ${bar.y}`);
      await shot(panel, 'marks-bar');
      await panel.keyboard.press('Escape');
      assert.equal(await panel.locator('#marks').isVisible(), false);
    });

    await check('меню с клавиатуры: Shift+F10, ↓, Enter, Esc', async () => {
      await goTo('m1');
      await panel.keyboard.press('Shift+F10');
      await menuShown();
      const focused = () => panel.evaluate(() => document.activeElement.closest('#menu [role="menuitem"]')?.querySelector('.label').textContent ?? null);
      assert.equal(await focused(), t('menu_open_new_tab'));
      await panel.keyboard.press('ArrowDown');
      assert.equal(await focused(), t('menu_open_new_window'));
      await panel.keyboard.press('Escape');
      await menuGone();
      assert.equal(await panel.evaluate(() => document.activeElement.id), 'list');
      await panel.keyboard.press('Shift+F10');
      await menuShown();
      for (let i = 0; i < 12 && await focused() !== t('cmd_copy'); i++) await panel.keyboard.press('ArrowDown');
      await panel.keyboard.press('Enter');
      await toast(t('clip_copied', 1));
      await menuGone();
    });

    await check('перетаскивание: у полосы «Выбрано» список прокручивается — она не закрывает цель', async () => {
      const long = await setup.evaluate(async () => {
        const f = await chrome.bookmarks.create({ parentId: '1', title: 'Long' });
        for (let i = 0; i < 25; i++) await chrome.bookmarks.create({ parentId: f.id, title: `l${String(i).padStart(2, '0')}`, url: `https://l${i}.example/` });
        return f.id;
      });
      await hasRow('Long');
      await goTo('Long');
      await panel.keyboard.press(expand);
      await hasRow('l24');
      await goTo('l00');
      await panel.keyboard.press('Space');
      const bar = await panel.locator('#marks').boundingBox();
      const before = await order(long);
      const from = await row('l00').boundingBox();
      const was = await panel.evaluate(() => scrollY);
      // над самой полосой (выше старой зоны в 28px от низа окна) — прокрутка всё равно идёт
      const [x, y0, y1] = [from.x + from.width / 2, from.y + from.height / 2, bar.y - 10];
      await panel.mouse.move(x, y0);
      await panel.mouse.down();
      for (let k = 1; k <= 8; k++) await panel.mouse.move(x, y0 + (y1 - y0) * k / 8);
      await panel.waitForFunction((was) => scrollY > was + 20, was);
      await panel.keyboard.press('Escape');
      await panel.mouse.up();
      await noDrop();
      assert.deepEqual(await order(long), before);
      await panel.keyboard.press('Escape'); // снять отметку
      await goTo('Long');
      await panel.keyboard.press(collapse);
    });

    await check('оформление: настройки сразу меняют открытую панель, свой CSS — только в панели', async () => {
      const style = (page, selector, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [selector, prop]);
      const until = (selector, prop, value) => panel.waitForFunction(([s, p, v]) => getComputedStyle(document.querySelector(s))[p] === v, [selector, prop, value]);
      assert.equal(await panel.locator('#theme').textContent(), ''); // тема по умолчанию: вид 2.6.0
      const options = await open('options.html');
      await options.waitForFunction(() => document.getElementById('theme-light-accent').value === '#2563eb');
      assert.equal(await options.locator('#appearance h2').textContent(), t('options_appearance'));
      assert.equal(await options.locator('#theme-light-accent-reset').isVisible(), false);
      // светлая тема со своим акцентом; затем тёмная — свой цвет у неё прежний
      await options.locator('#theme-mode').selectOption('light');
      await options.locator('#theme-light-accent').fill('#ff0000');
      await until('#marks', 'color', 'rgb(255, 0, 0)');
      assert.equal(await options.locator('#theme-light-accent-reset').isVisible(), true);
      await options.locator('#theme-mode').selectOption('dark');
      await until('#marks', 'color', 'rgb(126, 166, 255)');
      // счётчик у папки: текст строки остаётся названием
      await options.locator('#theme-counts').check();
      await panel.waitForFunction(() => [...document.querySelectorAll('#list .count')].some(c => c.checkVisibility()));
      assert.ok((await rowTexts()).includes('Работа'));
      // свой CSS: действует только включённым и только в панели
      await options.locator('#theme-css').fill('body { outline: 3px solid rgb(1, 2, 3); }');
      await options.locator('#theme-css').blur();
      await options.locator('#theme-css-on').check();
      await until('body', 'outlineColor', 'rgb(1, 2, 3)');
      assert.notEqual(await style(options, 'body', 'outlineColor'), 'rgb(1, 2, 3)');
      await options.locator('#theme-css-on').uncheck();
      await panel.waitForFunction(() => getComputedStyle(document.body).outlineStyle === 'none');
      await options.locator('#theme-reset').click();
      await panel.waitForFunction(() => document.getElementById('theme').textContent === '');
      assert.equal(await options.locator('#theme-mode').inputValue(), 'system');
      await options.close();
    });

    await check('превью оформления: панель на демо-закладках, тема видна сразу, настоящие закладки не затронуты', async () => {
      const options = await open('options.html');
      const frame = options.frameLocator('#theme-preview');
      await frame.locator('#list li', { hasText: 'Project board' }).waitFor();
      const rows = await frame.locator('#list li').allTextContents();
      assert.ok(!rows.includes('Работа'), 'в превью нет настоящих закладок');
      assert.equal(await frame.locator('#list li[aria-selected=true]').textContent(), 'Design notes'); // отмеченная демо-закладка
      assert.ok(await frame.locator('#list li.open').count()); // закладка с открытой вкладкой
      const before = await setup.evaluate(() => chrome.bookmarks.getTree().then(t => JSON.stringify(t)));
      await options.locator('#theme-mode').selectOption('light');
      await options.locator('#theme-light-accent').fill('#00aa00');
      await options.locator('#theme-radius').fill('2');
      await options.locator('#theme-radius').blur();
      await options.waitForFunction(() => document.getElementById('theme-preview').contentDocument.getElementById('theme').textContent.includes('#00aa00'));
      assert.match(await frame.locator('#theme').textContent(), /--radius: 2px/);
      // правка в превью (удаление выделенной) не доходит до настоящих закладок
      await frame.locator('#list').focus();
      await options.keyboard.press('Delete');
      await options.waitForTimeout(300);
      assert.equal(await setup.evaluate(() => chrome.bookmarks.getTree().then(t => JSON.stringify(t))), before);
      await options.locator('#theme-reset').click();
      await options.close();
    });

    await check('нет ошибок на страницах', async () => {
      await panel.waitForTimeout(300); // запоздалые ошибки обработчиков
      assert.deepEqual(errors, []);
    });
    total += checks.length;
  } finally {
    await context.close();
  }
}

try {
  const only = process.env.SMOKE_LOCALES?.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = (only ?? []).filter(n => !RUNS.some(r => r.name === n));
  assert.deepEqual(unknown, [], `SMOKE_LOCALES: нет прогона ${unknown}; есть: ${RUNS.map(r => r.name)}`);
  const selected = only ? RUNS.filter(r => only.includes(r.name)) : RUNS;
  assert.ok(selected.length, 'SMOKE_LOCALES пуст');

  // сборка — в копии репозитория, чтобы не трогать dist/ рабочего каталога
  const src = path.join(tmp, 'src');
  // сокеты (.codegraph/daemon.sock) cpSync не копирует: берём только файлы и каталоги
  fs.cpSync(root, src, { recursive: true, filter: (f) => {
    if (/[\\/](node_modules|dist|\.git)$/.test(f)) return false;
    const st = fs.lstatSync(f);
    return st.isFile() || st.isDirectory();
  } });
  const built = spawnSync(process.execPath, [path.join(repo, 'scripts', 'package.mjs'), src], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  const { version } = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
  new AdmZip(path.join(src, 'dist', `airnook-bookmarks-${version}.zip`)).extractAllTo(extDir);
  if (shots) fs.mkdirSync(shots, { recursive: true });
  // фиктивный перевод справа налево: копия en с другим языком и направлением
  fs.cpSync(extDir, rtlDir, { recursive: true });
  const he = JSON.parse(fs.readFileSync(path.join(extDir, '_locales', 'en', 'messages.json'), 'utf8'));
  he.locale.message = 'he';
  he.dir.message = 'rtl';
  fs.mkdirSync(path.join(rtlDir, '_locales', 'he'));
  fs.writeFileSync(path.join(rtlDir, '_locales', 'he', 'messages.json'), JSON.stringify(he));

  for (const r of selected) await run(r);
  console.log(`Смоук-тест пройден: ${total} проверок (${selected.map(r => r.name).join(', ')})`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
