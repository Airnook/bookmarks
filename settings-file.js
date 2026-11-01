// Файлы настроек (клавиши, тема): конверт и цепочка миграций по format.
// Что лежит в data — модуль не знает: это дело вызывающего.
export const APP = 'airnook-bookmarks';

export const envelope = (type, format, data, extensionVersion) => ({ app: APP, type, format, extensionVersion, data });

// Разбор файла. chain[n] переводит data формата n в формат n+1.
// Итог: { data } (в текущем формате) или { error: 'broken' | 'wrong_type' | 'newer' }.
export function readSettingsFile(text, type, format, chain = {}) {
  let file;
  try { file = JSON.parse(text); } catch { return { error: 'broken' }; }
  const { app, format: from, data } = file ?? {};
  if (app !== APP || !Number.isInteger(from) || from < 1 || !data || typeof data !== 'object') return { error: 'broken' };
  if (file.type !== type) return { error: 'wrong_type' };
  if (from > format) return { error: 'newer' };
  let current = data;
  for (let n = from; n < format; n++) current = chain[n](current);
  return { data: current };
}
