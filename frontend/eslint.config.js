import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      // Type-aware rules: these need the TS program, and catch things the
      // compiler alone won't (floating promises, unsafe `any` flows).
      ...tseslint.configs.recommendedTypeChecked,
      // `configs.flat.*` are the flat-config variants; the top-level
      // `configs.recommended` is still legacy eslintrc format.
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Must stay last so it can turn off rules that fight the formatter.
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Passing an async function to a JSX handler (onClick, onSubmit) is the
      // normal React idiom; we still want the rule's other checks.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // React Compiler rules. These flag real patterns worth revisiting (the
      // "set loading, then fetch" effect shape, Date.now() during render), but
      // clearing them is a refactor rather than a lint fix — warn for now.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  // This file isn't part of any tsconfig, so type-aware rules can't run on it.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
