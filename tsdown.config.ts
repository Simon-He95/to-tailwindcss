import { resolve } from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig({
  target: 'node14',
  format: ['cjs'],
  alias: {
    'transform-to-tailwindcss': resolve('node_modules/transform-to-tailwindcss/dist/index.mjs'),
  },
  external: [
    'vscode',
  ],
  noExternal: [
    '@typescript-eslint/typescript-estree',
    'fast-glob',
    /^svelte(?:\/.*)?$/,
    'transform-to-tailwindcss',
    'transform-to-tailwindcss-core',
  ],
  // minify: true,
  clean: true,
  platform: 'node', // 明确指定为 Node.js 平台
})
