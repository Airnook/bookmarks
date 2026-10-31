// Поиск: оценка совпадения запроса с записями и нечёткий поиск команд. Без DOM и состояния панели.

// Сравниваем без регистра и без разницы между «е» и «ё»
export const fold = (s) => s.toLowerCase().replaceAll('ё', 'е');
const WORD_CHAR = /[\p{L}\p{N}]/u;

// Насколько слово запроса подходит тексту: с начала — 3, с начала слова — 2, внутри слова — 1
export function fieldScore(text, word) {
  let at = text.indexOf(word);
  if (at < 0) return 0;
  if (at === 0) return 3;
  for (; at >= 0; at = text.indexOf(word, at + 1)) if (!WORD_CHAR.test(text[at - 1])) return 2;
  return 1;
}

// Одно слово: в названии — важнее всего, потом в адресе, потом в пути к папке.
// deep — нашлось только в адресе после сайта (тогда покажем адрес целиком).
export function matchWord(entry, word) {
  const t = fieldScore(entry.title, word);
  if (t) return { score: t * 100, strong: true };
  if (entry.url) {
    const u = fieldScore(entry.url, word);
    if (u) return { score: u * 10, strong: true, deep: !entry.host.includes(word) };
  }
  const p = fieldScore(entry.path, word);
  return p ? { score: p } : null;
}

// Каждое слово запроса должно найтись как набрано, и хотя бы одно — в названии или адресе
// (иначе «работа» выдала бы всё содержимое папки «Работа»).
export function scoreEntry(entry, words) {
  let score = 0;
  let strong = false;
  let deep = false;
  for (const word of words) {
    const match = matchWord(entry, word);
    if (!match) return null;
    score += match.score;
    strong ||= !!match.strong;
    deep ||= !!match.deep;
  }
  if (!strong) return null;
  const exact = entry.title === words.join(' ');
  return { score: score + (exact ? 1000 : 0), deep, tokens: words };
}

// Совпадения запроса среди записей, лучшие первыми
export function rank(entries, query, bonus = () => 0) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const found = [];
  entries.forEach((entry, order) => {
    const match = scoreEntry(entry, words);
    if (match) found.push({ entry, match, score: match.score + bonus(entry), order });
  });
  return found.sort((a, b) => b.score - a.score || a.order - b.order);
}

// Текст по кускам с отметкой совпадений слов запроса: [[кусок, совпал ли], …]
export function highlightParts(text, words) {
  const folded = fold(text);
  if (folded.length !== text.length) return [[text, false]]; // редкие буквы меняют длину — без подсветки
  const marks = new Array(text.length).fill(false);
  for (const word of words) {
    for (let at = folded.indexOf(word); at >= 0 && word; at = folded.indexOf(word, at + word.length)) {
      marks.fill(true, at, at + word.length);
    }
  }
  const out = [];
  for (let i = 0; i < text.length;) {
    let j = i;
    while (j < text.length && marks[j] === marks[i]) j++;
    const part = text.slice(i, j);
    out.push([part, marks[i]]);
    i = j;
  }
  return out;
}

// Нечёткий поиск: все буквы запроса по порядку; выше — подстрока, начало слова, буквы подряд
export function fuzzyScore(query, text) {
  if (!query) return 0;
  const at = text.indexOf(query);
  if (at >= 0) return 1000 - at + (at === 0 || text[at - 1] === ' ' ? 500 : 0);
  let score = 0;
  let from = 0;
  for (const ch of query) {
    const i = text.indexOf(ch, from);
    if (i < 0) return -1;
    score += i === from ? 5 : text[i - 1] === ' ' ? 3 : 1;
    from = i + 1;
  }
  return score;
}
