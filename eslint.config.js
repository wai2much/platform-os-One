import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// Flat config (required by ESLint 9+ — there is no eslintrc fallback here).
// Scope: catch real bugs (undefined vars, broken hooks rules, unreachable
// code) without fighting the existing codebase's style. This is a Vite +
// React app with no TypeScript and no test runner, so keep it to that.
export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '*.config.js'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules, // new JSX transform — no need to import React per file
      ...reactHooks.configs.recommended.rules,

      // The whole app is JS, not TS, and doesn't use PropTypes — this rule
      // would flag nearly every component for no real benefit here.
      'react/prop-types': 'off',
      // Vite Fast Refresh only warns; keep it a warning, not a lint failure.
      'react-refresh/only-export-components': 'warn',
      // Common in this codebase: intentionally-unused catch bindings and
      // destructured-but-unused props. Only flag unused vars that aren't
      // prefixed with _, and don't flag unused function args at all.
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
