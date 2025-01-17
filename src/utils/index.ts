import fg from 'fast-glob'
import { toTailwindcss } from 'transform-to-tailwindcss-core'
import * as vscode from 'vscode'

export type CssType = 'less' | 'scss' | 'css' | 'stylus'
export function getCssType(filename: string) {
  const data = filename.split('.')
  const ext = data.pop()!
  const result = ext === 'styl' ? 'stylus' : ext
  return result as CssType
}

export function getMultipedTailwindcssText(text: string) {
  const match = text.match(/style="([^"]+)"/)
  if (match)
    text = match[1]

  const selectedTexts = text.split(';').filter(i => i !== '"')
  let isChanged = false
  const selectedNewTexts = []
  for (let i = 0; i < selectedTexts.length; i++) {
    const text = selectedTexts[i]
    const newText = toTailwindcss(text) ?? text
    if (!newText)
      continue
    if (!isChanged)
      isChanged = newText !== text
    selectedNewTexts.push(newText)
  }
  // 没有存在能够转换的元素
  if (!isChanged)
    return

  const selectedCssText = selectedNewTexts.join(' ')
  return selectedCssText
}

export class LRUCache {
  private cache
  private maxSize
  constructor(maxSize: number) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get(key: any) {
    // 获取缓存值，并将其从Map中删除再重新插入，保证其成为最新的元素
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: any, value: any) {
    // 如果缓存已满，先删除最旧的元素
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    // 插入新值
    this.cache.set(key, value)
  }

  clear() {
    return this.cache.clear()
  }

  has(key: any) {
    return this.cache.has(key)
  }
}

export async function hasFile(source: string | string[]) {
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders)
    return
  const cwd = workspaceFolders[0].uri.fsPath
  const entries = await fg(source, {
    cwd,
    ignore: ['**/dist/**', '**/node_modules/**'],
  })

  return entries.length
}
