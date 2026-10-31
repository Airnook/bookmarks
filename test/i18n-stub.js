// Переводы для тестов: чтение _locales и стаб chrome.i18n, который ведёт себя как браузер —
// сообщение на языке браузера, а если его нет — из запасного языка (default_locale).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '_locales');
export const DEFAULT_LOCALE = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).default_locale;

// Языки, для которых есть перевод (имена каталогов: en, ru, pt_BR…)
export const locales = () => fs.readdirSync(dir).filter(d => fs.existsSync(path.join(dir, d, 'messages.json'))).sort();
export const readMessages = (lang) => JSON.parse(fs.readFileSync(path.join(dir, lang, 'messages.json'), 'utf8'));

// Ключи в браузере не различают регистр
const lowerKeys = (messages) => new Map(Object.entries(messages).map(([k, v]) => [k.toLowerCase(), v]));

// Подстановка как в браузере: $ИМЯ$ → content плейсхолдера, в нём $1…$9 → подстановки, $$ → $
function format(entry, subs) {
  const placeholders = new Map(Object.entries(entry.placeholders ?? {}).map(([n, p]) => [n.toLowerCase(), p.content]));
  const fill = (s) => s.replace(/\$(\d)/g, (_, i) => subs[i - 1] ?? '');
  return entry.message.split('$$')
    .map(part => fill(part.replace(/\$([\w@]+)\$/g, (_, name) => placeholders.get(name.toLowerCase()) ?? '')))
    .join('$');
}

// getMessage для языка браузера ui (например, 'ru' или 'de' — без перевода)
export function getMessageFor(ui) {
  const own = locales().includes(ui) ? lowerKeys(readMessages(ui)) : new Map();
  const fallback = lowerKeys(readMessages(DEFAULT_LOCALE));
  return (key, subs = []) => {
    const k = key.toLowerCase();
    if (k === '@@ui_locale') return ui;
    const entry = own.get(k) ?? fallback.get(k);
    return entry ? format(entry, [subs].flat()) : '';
  };
}

// Модули расширения берут chrome.i18n из глобального chrome
export function useLocale(ui) {
  globalThis.chrome = { ...globalThis.chrome, i18n: { getMessage: getMessageFor(ui), getUILanguage: () => ui } };
}
