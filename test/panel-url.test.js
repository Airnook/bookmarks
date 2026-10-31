import './locale-ru.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { domainToASCII, domainToUnicode } from 'node:url';
import { punycode, unicodeHost, splitUrl, exactUrl, looseUrl, siteOf, isBookmarklet } from '../panel/url.js';

// Настоящие кириллические домены (сайты госорганов и др.)
const DOMAINS = {
  'xn--d1abbgf6aiiy.xn--p1ai': 'президент.рф',
  'xn--c1aapkosapc.xn--p1ai': 'госуслуги.рф',
  'xn--80aesfpebagmfblc0a.xn--p1ai': 'стопкоронавирус.рф',
  'xn--e1afmkfd.xn--p1ai': 'пример.рф',
  'xn--j1ay.xn--p1ai': 'кц.рф',
  'xn--80atc1g.xn--p1ai': 'ёлка.рф',
  'xn--90ais': 'бел',
  'xn--j1amh': 'укр',
};

test('punycode / unicodeHost: кириллические домены', () => {
  for (const [ascii, unicode] of Object.entries(DOMAINS)) {
    assert.equal(unicodeHost(ascii), unicode, ascii);
    assert.equal(unicodeHost(ascii), domainToUnicode(ascii), `${ascii}: как в node:url`);
    assert.equal(domainToASCII(unicode), ascii, `${unicode}: проверка самих данных`);
  }
  assert.equal(punycode('e1afmkfd'), 'пример');
  assert.equal(punycode('d1acufc'), 'домен');
});

test('punycode: смешанная метка с ASCII-частью, обычные метки не трогаются', () => {
  assert.equal(unicodeHost('xn--mnchen-3ya.de'), 'münchen.de');
  assert.equal(unicodeHost('example.com'), 'example.com');
  assert.equal(unicodeHost('www.xn--e1afmkfd.xn--p1ai'), 'www.пример.рф');
});

test('unicodeHost: испорченная метка остаётся как есть', () => {
  assert.throws(() => punycode('e1afmkf!'));
  assert.equal(unicodeHost('xn--e1afmkf!.xn--p1ai'), 'xn--e1afmkf!.рф');
  assert.equal(unicodeHost('xn--zzzzzzzz.com'), 'xn--zzzzzzzz.com');
});

test('splitUrl: сайт без www и остальное с русскими буквами', () => {
  assert.deepEqual(splitUrl('https://www.xn--e1afmkfd.xn--p1ai/%D0%BF%D1%83%D1%82%D1%8C?q=%D1%8F#x'), ['пример.рф', '/путь?q=я#x']);
  assert.deepEqual(splitUrl('https://example.com/'), ['example.com', '']);
  assert.deepEqual(splitUrl('https://example.com:8080/a'), ['example.com:8080', '/a']);
  assert.deepEqual(splitUrl('http://wwwx.example.com/'), ['wwwx.example.com', '']);
  assert.deepEqual(splitUrl('file:///tmp/a%20b.txt'), ['', '/tmp/a b.txt']);
});

test('splitUrl: букмарклет, не адрес, битая %-последовательность', () => {
  assert.deepEqual(splitUrl('javascript:alert(1)'), ['', '']);
  assert.deepEqual(splitUrl('not a url'), ['', 'not a url']);
  assert.deepEqual(splitUrl('https://e.com/%E0%A4%A'), ['e.com', '/%E0%A4%A']); // decodeURI падает — как есть
});

test('splitUrl: повторный вызов — тот же результат из кэша', () => {
  const url = 'https://xn--80aswg.xn--p1ai/x';
  assert.equal(splitUrl(url), splitUrl(url));
  assert.deepEqual(splitUrl(url), ['сайт.рф', '/x']);
});

test('exactUrl / looseUrl: без хвостового «/», looseUrl — и без #якоря', () => {
  assert.equal(exactUrl('https://e.com/a/'), 'https://e.com/a');
  assert.equal(exactUrl('https://e.com/a#b/'), 'https://e.com/a#b');
  assert.equal(looseUrl('https://e.com/a/#top'), 'https://e.com/a');
  assert.equal(exactUrl(), '');
  assert.equal(looseUrl(), '');
});

test('siteOf: сайт, путь файла, букмарклет, прочее', () => {
  assert.equal(siteOf('https://www.xn--e1afmkfd.xn--p1ai/x'), 'пример.рф');
  assert.equal(siteOf('file:///home/me/doc.pdf'), '/home/me/doc.pdf');
  assert.equal(siteOf('JavaScript:void(0)'), 'букмарклет');
  assert.equal(isBookmarklet('javascript:x'), true);
  assert.equal(siteOf('chrome://extensions/'), 'chrome://extensions/');
  assert.equal(siteOf('data:text/plain,' + 'x'.repeat(100)).length, 80);
});
