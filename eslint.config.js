import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Disallow console calls in production (allow errors for critical issues)
      'no-console': ['warn', { allow: ['error'] }],
      // Allow headless heading components (content provided via children)
      'jsx-a11y/heading-has-content': 'off',
      // Allow standalone label components (htmlFor provided at usage)
      'jsx-a11y/label-has-associated-control': 'off',

      // STYLING STANDARDIZATION: Inline style rule disabled after colors.ts removal
      // Re-enable in future phases when ready to migrate remaining inline styles to Tailwind
      // 'no-restricted-syntax': [
      //   'warn',
      //   {
      //     selector: 'JSXAttribute[name.name="style"]',
      //     message: 'Avoid inline styles. Use Tailwind CSS classes instead. Migrate to Tailwind classes in component refactoring phases.',
      //   },
      // ],
    },
  },
])
