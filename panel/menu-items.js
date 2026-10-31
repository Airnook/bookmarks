// Пункты меню правой кнопкой: какие и в каком порядке — как в меню закладок браузера.
// Без DOM и состояния панели: на входе — что под мышью и что сейчас можно, на выходе —
// список { id, reason } и разделители '-' (у папки «Изменить» называется «Переименовать»).
// reason — почему пункт неактивен (код причины,
// текст подбирает context-menu.js), null — пункт работает.
//
// what: 'bookmark' | 'folder' | 'group' (несколько отмеченных) | 'empty' (пустое место списка)
// ctx: {
//   count     — сколько закладок откроется (без букмарклетов, у папки и группы — со вложенными);
//   bookmarklet — закладка — букмарклет (javascript:);
//   locked    — узел (у группы — все узлы) нельзя менять: код причины 'system' | 'managed', иначе null;
//   place     — куда встанет вставленное и новое нельзя класть: 'managed', иначе null;
//   clipboard — буфер: 'empty' | 'copy' | 'cut'; inside — вырезанная папка — та, куда вставляем;
//   split     — браузер умеет разделение экрана; incognito — расширению разрешён режим инкогнито;
//   undo, redo — есть что отменить, повторить
// }

const off = (cond, reason) => (cond ? reason : null);

function openItems(what, ctx) {
  const incognito = off(!ctx.incognito, 'incognito');
  if (what === 'bookmark') {
    const bookmarklet = off(ctx.bookmarklet, 'bookmarklet');
    return [
      { id: 'open.newTab', reason: bookmarklet },
      { id: 'open.newWindow', reason: bookmarklet },
      ...(ctx.split ? [{ id: 'open.split', reason: bookmarklet }] : []),
      { id: 'open.incognito', reason: bookmarklet ?? incognito },
    ];
  }
  const nothing = off(!ctx.count, 'nothing');
  return [
    { id: 'open.all', reason: nothing },
    { id: 'open.allNewWindow', reason: nothing },
    { id: 'open.allIncognito', reason: nothing ?? incognito },
    { id: 'open.group', reason: nothing },
  ];
}

function pasteReason(ctx) {
  if (ctx.clipboard === 'empty') return 'clipboard';
  if (ctx.place) return ctx.place;
  return off(ctx.inside, 'inside');
}

const tail = (ctx) => ['-', { id: 'undo', reason: off(!ctx.undo, 'undo') }, { id: 'redo', reason: off(!ctx.redo, 'redo') }];

export function menuItems(what, ctx) {
  const add = [{ id: 'bookmark.add', reason: ctx.place }, { id: 'folder.new', reason: ctx.place }];
  if (what === 'empty') {
    return [
      { id: 'paste', reason: pasteReason(ctx) },
      '-', ...add,
      '-', { id: 'manager', reason: null },
      '-', { id: 'search', reason: null }, { id: 'palette', reason: null }, { id: 'settings', reason: null },
      ...tail(ctx),
    ];
  }
  const locked = ctx.locked ?? null;
  return [
    ...openItems(what, ctx),
    '-', { id: 'edit', reason: what === 'group' ? 'one' : locked },
    '-', { id: 'cut', reason: locked }, { id: 'copy', reason: null }, { id: 'paste', reason: pasteReason(ctx) },
    '-', { id: 'delete', reason: locked },
    '-', ...add,
    '-', { id: 'manager', reason: null },
    ...tail(ctx),
  ];
}
