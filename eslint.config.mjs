import js from '@eslint/js';
import globals from 'globals';

const sharedRules = {
  ...js.configs.recommended.rules,
  // Pierwszy rygorystyczny próg koncentruje się na błędach wykonania.
  // Pozostałe reguły będą zaostrzane modułami, bez ukrywania regresji.
  'no-unused-vars': 'off',
  'no-control-regex': 'off',
  'no-empty': 'off',
  'no-useless-assignment': 'off',
  'no-useless-escape': 'off',
  'preserve-caught-error': 'off',
  'no-misleading-character-class': 'off',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'assets/**',
      'products.json',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'releases/**',
    ],
  },
  {
    files: ['server.mjs', 'src/backend/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'playwright.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: sharedRules,
  },
  {
    files: ['src/frontend/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      ...sharedRules,
      // Pliki przeglądarkowe są składane w jeden kontrolowany pakiet i dzielą
      // funkcje globalne. no-undef/no-unused-vars byłyby tu fałszywym alarmem.
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['tests/e2e/**/*.mjs'],
    rules: { 'no-undef': 'off' },
  },
];
