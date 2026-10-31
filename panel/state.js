// Общее изменяемое состояние панели и его сохранение между открытиями.
// Всё, что читают и меняют несколько модулей, — свойства state; служебное
// одного модуля (таймеры, очереди, счётчики) живёт в нём самом.
import { SETTINGS_DEFAULTS } from '../commands.js';
import { debounce } from './util.js';

export const state = {
  settings: { ...SETTINGS_DEFAULTS },
  treeRoot: null,             // узел, чьи дети — верхний уровень (стартовая папка или корень)
  tree: [],                   // видимые корневые узлы
  rows: [],                   // видимые строки: { node, depth } (в поиске — { node, depth, hit })
  sel: 0,                     // строка под курсором
  selId: null,
  expanded: new Set(['1']),   // по умолчанию раскрыта «Панель закладок»
  marked: new Set(),          // отмеченные пробелом
  keymap: {},                 // изменённые сочетания клавиш (остальные — по умолчанию)
  resolved: new Map(),        // итоговые сочетания: id команды → список
  bindings: new Map(),        // сочетание → команда (см. buildKeymap)
  pending: null,              // начатая последовательность клавиш: { seq, command, timer }
  nodeById: new Map(),        // все узлы кэша по id
  sizes: new Map(),           // id папки → сколько в ней закладок (со вложенными)
  bookmarkByUrl: new Map(),   // адрес → id закладки (точный и, с «~», без #якоря)
  bookmarkIds: new Set(),     // id всех закладок в списке
  openTabs: new Map(),        // id закладки → id её вкладок в этом окне (свежие первыми)
  activeBookmark: null,       // закладка текущей вкладки
  windowId: null,
  winReady: null,             // обещание: windowId уже известен (см. connectBackground)
  scrollTarget: null,         // докрутить до этой строки, как только она появится в списке
  recentFolders: [],          // куда недавно перемещали (id папок, свежие первыми)
  preparing: false,           // команда готовит своё окно или поле — клавиши пока не команды
  typeAhead: null,            // пока создаётся папка — напечатанное заранее: { text, enter, cancel }
  search: null,               // идёт поиск: { query, prevSelId — где был курсор в дереве, more — не показано }
  searchIndex: null,          // закладки и папки для поиска; строится при первом поиске после загрузки
  folderIndex: null,          // только папки — для выбора «куда переместить»
  afterRename: false,         // чтение дерева отложено до конца переименования
  picker: null,               // открытый выбор из списка (палитра или папка), см. openPicker
  showNews: false,            // после обновления справка откроется сразу на «Что нового»
};

// Раскрытые папки и выделение переживают закрытие панели. Отметки — только
// пересоздание панели в том же окне (доли секунды), чтобы не всплывали через день,
// в другом окне или после обычного закрытия и открытия.
export const MARKS_SURVIVE = 3000;
// Сохранённое прошлой панелью; читается один раз, при загрузке модуля
export let saved = null;
try {
  saved = JSON.parse(localStorage.getItem('state'));
  if (saved) { state.expanded = new Set(saved.expanded); state.selId = saved.selId; }
} catch {
  // испорченная запись или хранилище недоступно — начинаем с умолчаний
}

export function persist() {
  try {
    localStorage.setItem('state', JSON.stringify({
      expanded: [...state.expanded], selId: state.search?.query ? state.search.prevSelId : state.selId,
      marked: [...state.marked], win: state.windowId, at: Date.now(),
    }));
  } catch {
    // хранилище переполнено или недоступно — состояние просто не переживёт закрытие панели
  }
}
export const saveState = debounce(persist, 300);
