// @ts-check
const antfu = require('@antfu/eslint-config').default

module.exports = antfu(
  {
    ignores: [
      // eslint ignore globs here
      'test/**/*',
    ],
  },
  {
    rules: {
      // overrides
      'import/newline-after-import': 'off',
      'perfectionist/sort-imports': 'off',
      'ts/no-require-imports': 'off',
    },
  },
)
