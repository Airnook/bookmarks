import js from '@eslint/js';
import globals from 'globals';

// Страницы расширения — ES-модули с явными импортами (общее — из commands.js).
// Фоновый скрипт — обычный service worker, не модуль.
const browser = { ...globals.browser, ...globals.webextensions };

export default [
  { ignores: ['node_modules/', 'dist/'] },
  js.configs.recommended,
  {
    files: ['background.js', 'commands.js', 'help.js', 'i18n.js', 'options.js', 'panel/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browser },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] },
  },
  {
    files: ['background.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    files: ['eslint.config.js', 'scripts/**/*.mjs', 'test/**/*.js', 'test/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
  {
    // смоук-тест передаёт функции в страницы расширения (page.evaluate)
    files: ['test/*.browser.mjs'],
    languageOptions: { globals: { ...globals.node, ...browser } },
  },
];
