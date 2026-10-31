// Клик по иконке расширения тоже открывает панель
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Первая установка — показать справку (а панель при первом открытии подскажет,
// где все команды); обновление — панель один раз подскажет, что нового
chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
  const { version } = chrome.runtime.getManifest();
  if (reason === 'install') {
    chrome.tabs.create({ url: 'help.html' }).catch(() => {});
    chrome.storage.local.set({ firstRun: true });
  }
  if (reason === 'update' && previousVersion !== version) chrome.storage.local.set({ whatsNew: version });
});

// Связи «вкладка → закладка» (режим закреплённых вкладок) живут, пока жива вкладка.
// Браузер иногда подменяет вкладку новой (предзагрузка) — связь переходит к ней.
chrome.tabs.onRemoved.addListener((tabId) => { chrome.storage.session.remove('link:' + tabId).catch(() => {}); });
chrome.tabs.onReplaced.addListener(async (added, removed) => {
  const key = 'link:' + removed;
  const { [key]: bookmarkId } = await chrome.storage.session.get(key);
  if (bookmarkId) await chrome.storage.session.set({ ['link:' + added]: bookmarkId });
  chrome.storage.session.remove(key).catch(() => {});
});

// Открытые панели: windowId → Map(instance → в фокусе ли). Каждая загрузка
// панели — новый instance. Закрытые instance запоминаем, чтобы их запоздалые
// сообщения не «воскресили» панель.
const windows = new Map();
const gone = new Set();
// Закрытые окна: их id не переиспользуются, поэтому запоздалые сообщения от панелей
// таких окон просто игнорируем.
const closedWindows = new Set();
const panelsIn = (w) => windows.get(w) ?? windows.set(w, new Map()).get(w);
// Скрипт уже получал сообщения от панелей. Отдельный флаг нужен, потому что запись
// закрытого окна удаляется (onRemoved): по пустому windows нельзя отличить «только
// что запущен» от «панели были, окна закрыты».
let knowsPanels = false;

function setState(windowId, instance, focused) {
  knowsPanels = true;
  if (gone.has(instance) || closedWindows.has(windowId)) return;
  if (focused !== null) return panelsIn(windowId).set(instance, focused);
  // без panelsIn: разрыв порта после onRemoved не должен заново создать запись окна
  windows.get(windowId)?.delete(instance);
  gone.add(instance);
  if (gone.size > 200) gone.delete(gone.values().next().value);
}

// Пока соединение с панелью живо, она открыта. Если браузер всё же выгрузит
// этот скрипт, панель переподключится и снова сообщит о себе.
chrome.runtime.onConnect.addListener((port) => {
  const [kind, windowId, instance] = port.name.split(':');
  if (kind === 'panel') port.onDisconnect.addListener(() => setState(+windowId, instance, null));
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'panel-state') setState(msg.windowId, msg.instance, msg.closed ? null : msg.focused);
  if (msg?.type === 'open-set') openSet(msg);
});

// Окно закрыто — его записи не нужны. knowsPanels при этом не сбрасываем.
chrome.windows.onRemoved.addListener((windowId) => {
  windows.delete(windowId);
  closedWindows.add(windowId);
  if (closedWindows.size > 200) closedWindows.delete(closedWindows.values().next().value);
});

// Открыть набор закладок фоновыми вкладками; с названием — собрать их в группу.
// Уже открытые вкладки закладок (tabId) не дублируем — берём их же.
// Делается здесь, а не в панели: панель с автоскрытием может закрыться посреди работы.
async function openSet({ windowId, items, group, link }) {
  const opened = []; // [id вкладки, id закладки]
  for (const { id, url, tabId } of items) {
    const existing = tabId && await chrome.tabs.get(tabId).catch(() => null);
    const tab = existing?.windowId === windowId ? existing
      : await chrome.tabs.create({ windowId, url, active: false }).catch(() => null);
    if (tab) opened.push([tab.id, id]);
  }
  if (!opened.length) return;
  const tabIds = opened.map(([tabId]) => tabId);
  // в режиме закреплённых вкладок вкладки привязываются к своим закладкам
  if (link) await chrome.storage.session.set(Object.fromEntries(opened.map(([t, b]) => ['link:' + t, b])));
  if (group) {
    const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } }).catch(() => null);
    if (groupId !== null) await chrome.tabGroups.update(groupId, { title: group }).catch(() => {});
  }
  chrome.tabs.update(tabIds[0], { active: true }).catch(() => {});
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'open-bookmarks' || !tab) return;
  const windowId = tab.windowId;
  const here = windows.get(windowId);
  const open = (w) => chrome.sidePanel.open({ windowId: w }).catch(() => {});

  // фокус в панели → закрыть
  if (here && [...here.values()].some(Boolean)) {
    here.forEach((_, i) => here.set(i, false));
    chrome.sidePanel.close({ windowId }).catch(() => {});
    return;
  }

  // Точно закрыта → просто открыть (при открытии панель сама получает фокус).
  // Окно, о котором ничего не известно, тоже закрыто, если скрипт уже следит
  // за панелями (knowsPanels). Если не следит, его только что запустили и он не знает.
  if (here ? !here.size : knowsPanels) return open(windowId);

  // Пока панель открыта ещё в каком-то окне, пересоздание не возвращает её
  // в этом (особенность браузера). Тогда просто закрываем — следующее нажатие
  // откроет панель уже с фокусом, а соседние окна не трогаем.
  if ([...windows].some(([w, panels]) => w !== windowId && panels.size)) {
    chrome.sidePanel.close({ windowId }).catch(() => {});
    return;
  }

  // Открыта, но фокус на странице (или состояние неизвестно) → пересоздать панель:
  // забрать фокус у страницы иначе браузер не даёт. Всё синхронно: после await
  // браузер уже не разрешит открыть панель.
  chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});
  chrome.sidePanel.setOptions({ enabled: true, path: 'panel.html' }).catch(() => {});
  open(windowId);
});
