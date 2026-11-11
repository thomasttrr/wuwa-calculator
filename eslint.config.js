import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'data/snapshots', 'data/game', 'data/raw', 'verification', 'public'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.{ts,tsx}', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
  },
  {
    // The damage engine is pure TypeScript. It may import only its own files:
    // no packages, no aliases. tests/engine/boundary.test.ts checks that
    // relative imports also stay inside src/engine.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^[^.]',
              message: 'The engine may only import its own files by relative path.',
            },
          ],
        },
      ],
    },
  },
)
