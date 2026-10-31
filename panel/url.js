// Адреса закладок: сравнение, показ, сайт, пустые и стартовые страницы. Без DOM и состояния панели.
import { t } from '../i18n.js';

export const exactUrl = (u = '') => u.replace(/\/$/, '');
export const looseUrl = (u = '') => exactUrl(u.replace(/#.*/, ''));

export const isBookmarklet = (url) => /^javascript:/i.test(url); // расширениям такое открывать нельзя

// Что показать под названием: сайт; у файла — путь; у букмарклета — так и написать
export function siteOf(url) {
  if (isBookmarklet(url)) return t('bookmarklet');
  const [host, rest] = splitUrl(url);
  if (/^https?:/i.test(url)) return host;
  if (/^file:/i.test(url)) return rest;
  return url.slice(0, 80);
}

// Кириллический домен браузер хранит как xn--…: «xn--e1afmkfd.xn--p1ai» → «пример.рф» (RFC 3492)
export function punycode(label) {
  const base = 36, tMin = 1, tMax = 26;
  const adapt = (delta, points, first) => {
    delta = first ? Math.floor(delta / 700) : delta >> 1;
    delta += Math.floor(delta / points);
    let k = 0;
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return Math.floor(k + (base - tMin + 1) * delta / (delta + 38));
  };
  const digit = (c) => (c >= 48 && c <= 57 ? c - 22 : c >= 65 && c <= 90 ? c - 65 : c >= 97 && c <= 122 ? c - 97 : base);
  const dash = label.lastIndexOf('-');
  const out = dash > 0 ? [...label.slice(0, dash)] : [];
  let n = 128, i = 0, bias = 72;
  for (let k = dash > 0 ? dash + 1 : 0; k < label.length;) {
    const old = i;
    for (let w = 1, t = base; ; t += base) {
      if (k >= label.length) throw new Error('bad punycode');
      const d = digit(label.charCodeAt(k++));
      if (d >= base) throw new Error('bad punycode');
      i += d * w;
      const th = t <= bias ? tMin : t >= bias + tMax ? tMax : t - bias;
      if (d < th) break;
      w *= base - th;
    }
    bias = adapt(i - old, out.length + 1, old === 0);
    n += Math.floor(i / (out.length + 1));
    i %= out.length + 1;
    out.splice(i++, 0, String.fromCodePoint(n));
  }
  return out.join('');
}
export const unicodeHost = (host) => host.split('.').map(part => {
  if (!part.startsWith('xn--')) return part;
  try { return punycode(part.slice(4)); } catch { return part; }
}).join('.');

// Адрес для поиска и показа: сайт без www и остальное (с русскими буквами вместо %D0%…).
// Разбор адреса недешёвый, а закладки меняются редко — помним результат.
const urlParts = new Map();
export function splitUrl(url) {
  let parts = urlParts.get(url);
  if (parts) return parts;
  try {
    const u = new URL(url);
    let rest = u.pathname + u.search + u.hash;
    try { rest = decodeURI(rest); } catch { /* битая %-последовательность — показываем как есть */ }
    parts = u.protocol === 'javascript:' ? ['', ''] : [unicodeHost(u.host.replace(/^www\./, '')), rest === '/' ? '' : rest];
  } catch {
    parts = ['', url];
  }
  urlParts.set(url, parts);
  return parts;
}

// Забыть разобранные адреса, если их набралось больше limit (адреса удалённых закладок)
export function trimUrlCache(limit) {
  if (urlParts.size > limit) urlParts.clear();
}

// Пустая вкладка или стартовая страница браузера: закладке такой адрес не нужен.
// Покрыто: пустой адрес; about:blank и about:newtab; chrome://newtab и chrome://new-tab-page
// (Chromium); chrome-search://local-ntp (локальная NTP Chromium); edge://newtab (Edge);
// brave://newtab и brave://new-tab-page (Brave); vivaldi://startpage и
// chrome://vivaldi-webui/startpage (Vivaldi); opera://startpage и chrome://startpage (Opera).
// Прочие служебные страницы (chrome://extensions и т.п.) сюда не входят.
export function isBlankPage(url) {
  if (!url) return true;
  return /^about:\/*(blank|newtab)(?![\w-])/i.test(url)
    || /^(chrome|edge|brave|opera|vivaldi):\/*(newtab|new-tab-page|startpage)(?![\w-])/i.test(url)
    || /^chrome-search:\/*local-ntp(?![\w-])/i.test(url)
    || /^chrome:\/*vivaldi-webui\/startpage(?![\w-])/i.test(url);
}
