import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, fieldScore, matchWord, scoreEntry, rank, highlightParts, fuzzyScore } from '../panel/search.js';

// Запись индекса, как её строит панель: поля уже приведены fold
const entry = (title, { host = '', rest = '', path = '' } = {}) => ({
  title: fold(title), path: fold(path), ...(host || rest ? { host: fold(host), url: fold(host + rest) } : {}),
});

test('fold: без регистра, «ё» = «е»', () => {
  assert.equal(fold('Ёлка ЁЖ Mail'), 'елка еж mail');
});

test('fieldScore: с начала — 3, с начала слова — 2, внутри слова — 1, нет — 0', () => {
  assert.equal(fieldScore('почта яндекс', 'почта'), 3);
  assert.equal(fieldScore('почта яндекс', 'янд'), 2);
  assert.equal(fieldScore('github.com/user', 'user'), 2); // после знака — начало слова
  assert.equal(fieldScore('почта яндекс', 'декс'), 1);
  assert.equal(fieldScore('почта яндекс', 'гугл'), 0);
  assert.equal(fieldScore('ааа баа', 'аа'), 3);
  assert.equal(fieldScore('бааа ааа', 'аа'), 2); // первое вхождение внутри слова, следующее — с начала
});

test('matchWord: название важнее адреса, адрес — пути', () => {
  const e = entry('Почта', { host: 'mail.yandex.ru', rest: '/inbox', path: 'Работа › Связь' });
  assert.deepEqual(matchWord(e, 'почта'), { score: 300, strong: true });
  assert.deepEqual(matchWord(e, 'yandex'), { score: 20, strong: true, deep: false });
  assert.deepEqual(matchWord(e, 'inbox'), { score: 20, strong: true, deep: true }); // только после сайта
  assert.deepEqual(matchWord(e, 'связь'), { score: 2 });
  assert.equal(matchWord(e, 'нет'), null);
});

test('scoreEntry: все слова должны найтись, хотя бы одно — в названии или адресе', () => {
  const e = entry('Почта', { host: 'mail.yandex.ru', path: 'Работа' });
  assert.equal(scoreEntry(e, ['работа']), null); // только путь — не считается
  assert.deepEqual(scoreEntry(e, ['работа', 'mail']), { score: 1 * 3 + 30, deep: false, tokens: ['работа', 'mail'] });
  assert.equal(scoreEntry(e, ['почта', 'нет']), null);
  assert.equal(scoreEntry(e, ['почта']).score, 300 + 1000); // точное совпадение названия
});

test('rank: лучшие первыми, при равенстве — порядок записей; bonus добавляется', () => {
  const entries = [
    entry('Мой проект'), entry('Проект'), entry('Проекты 2024'), entry('Архив', { path: 'Проект' }), entry('Другое'),
  ];
  const titles = (found) => found.map(f => f.entry.title);
  assert.deepEqual(titles(rank(entries, 'проект')), ['проект', 'проекты 2024', 'мой проект']);
  assert.deepEqual(titles(rank(entries, '  ПРОЕКТ  ')), ['проект', 'проекты 2024', 'мой проект']);
  assert.deepEqual(titles(rank(entries, 'проект', (e) => (e.title === 'мой проект' ? 2000 : 0))), ['мой проект', 'проект', 'проекты 2024']);
  assert.deepEqual(rank(entries, 'нет такого'), []);
});

test('highlightParts: куски с отметкой совпадений', () => {
  assert.deepEqual(highlightParts('Ёлки и ёжики', ['е']), [['Ё', true], ['лки и ', false], ['ё', true], ['жики', false]]);
  assert.deepEqual(highlightParts('abcabc', ['bc']), [['a', false], ['bc', true], ['a', false], ['bc', true]]);
  assert.deepEqual(highlightParts('abc', ['ab', 'bc']), [['abc', true]]);
  assert.deepEqual(highlightParts('abc', ['']), [['abc', false]]);
  assert.deepEqual(highlightParts('', ['a']), []);
  // буква, у которой длина меняется при смене регистра (İ → i̇) — без подсветки
  assert.deepEqual(highlightParts('İstanbul', ['stan']), [['İstanbul', false]]);
});

test('fuzzyScore: подстрока лучше букв по порядку, начало слова — выше', () => {
  assert.equal(fuzzyScore('', 'что угодно'), 0);
  assert.equal(fuzzyScore('вид', 'сменить вид'), 1000 - 8 + 500); // с начала слова
  assert.equal(fuzzyScore('мен', 'сменить вид'), 1000 - 1); // внутри слова
  assert.equal(fuzzyScore('сменить', 'сменить вид'), 1500);
  assert.equal(fuzzyScore('свд', 'сменить вид'), 5 + 3 + 1); // подряд, начало слова, через букву
  assert.equal(fuzzyScore('дс', 'сменить вид'), -1); // не по порядку
  assert.ok(fuzzyScore('вид', 'сменить вид') > fuzzyScore('свд', 'сменить вид'));
});
