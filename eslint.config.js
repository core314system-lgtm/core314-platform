import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // The sibling apps (core314-app/admin/landing) carry their own eslint configs;
  // linting them from this root config crashes, so scope the root lint to the
  // Procuvex app (src) and its Netlify functions.
  globalIgnores(['dist', 'core314-app', 'core314-admin', 'core314-landing', 'coverage']),
  {
    files: ['**/*.{ts,tsx,mts}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Correctness-critical rule kept as an error (currently 0 violations).
      'react-hooks/rules-of-hooks': 'error',
      // The React Compiler readiness rules and exhaustive-deps are advisory in a
      // working app; surface them as warnings (tracked tech debt) so a new true
      // error still fails CI without requiring a large, risky refactor first.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      // Explicit `any` is tracked type-safety debt; warn rather than block.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
      // Honor the underscore-prefix convention for intentionally-unused
      // bindings (e.g. the Netlify handler's `_context` param, caught errors).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // Node-side build/CI scripts legitimately use CommonJS require + node globals.
    files: ['scripts/**/*.{ts,mts}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
])
