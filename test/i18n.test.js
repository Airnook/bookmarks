// Подстановки в t/plural изолированы (FSI … PDI), а метки мест в localizePage — нет.
import test from 'node:test';
import assert from 'node:assert/strict';
import { useLocale } from './i18n-stub.js';

test('t: подстановки обёрнуты в FSI … PDI; текст без подстановок — как есть', async () => {
  const { t, isolate } = await import('../i18n.js');
  useLocale('ar');
  assert.equal(t('delete_folder', 'Empty folder'), `هل تريد حذف المجلد “${isolate('Empty folder')}”؟`);
  assert.equal(isolate('x'), '⁨x⁩');
  assert.equal(t('locale'), 'ar');
});

test('localizePage: вложенные элементы встают на места, метки не изолируются', async () => {
  const { localizePage } = await import('../i18n.js');
  useLocale('en');
  const kid = { tag: 'a' };
  const el = { dataset: { i18n: 'options_intro' }, children: [kid], replaceChildren(...nodes) { this.nodes = nodes; } };
  globalThis.document = {
    querySelectorAll: (sel) => (sel === '[data-i18n]' ? [el] : []),
    documentElement: {},
  };
  try {
    localizePage();
    assert.deepEqual(el.nodes, ['All features, workflows and keys are in the ', kid, '.']);
    assert.equal(globalThis.document.documentElement.lang, 'en');
  } finally {
    delete globalThis.document;
  }
});
