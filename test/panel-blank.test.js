// isBlankPage из panel/url.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlankPage } from '../panel/url.js';

test('isBlankPage: пустой адрес и about:blank / about:newtab', () => {
  for (const url of ['', undefined, null, 'about:blank', 'about:newtab', 'ABOUT:BLANK']) {
    assert.equal(isBlankPage(url), true, url);
  }
});

test('isBlankPage: Chromium (Chrome, Helium, Yandex-подобные Chromium-варианты)', () => {
  // chrome://newtab и chrome-search://local-ntp — Chromium search.h (rewrite-правило NTP)
  for (const url of [
    'chrome://newtab', 'chrome://newtab/', 'chrome://new-tab-page/', 'chrome://new-tab-page',
    'chrome-search://local-ntp/local-ntp.html', 'chrome-search://local-ntp/',
  ]) assert.equal(isBlankPage(url), true, url);
});

test('isBlankPage: Edge, Brave, Vivaldi, Opera', () => {
  for (const url of [
    'edge://newtab/', 'edge://newtab',
    'brave://newtab/', 'brave://new-tab-page/',
    'vivaldi://startpage', 'chrome://vivaldi-webui/startpage',
    'opera://startpage/', 'chrome://startpage/',
  ]) assert.equal(isBlankPage(url), true, url);
});

test('isBlankPage: обычные страницы и прочие служебные адреса не отбрасываются', () => {
  for (const url of [
    'https://example.com', 'https://example.com/newtab', 'https://newtab.example.com',
    'chrome://extensions/', 'chrome://settings/', 'chrome://newtabs/', 'chrome://newtab-foo/',
    'edge://newtab-settings/', 'about:version', 'file:///tmp/newtab',
  ]) assert.equal(isBlankPage(url), false, url);
});
