import * as vscode from 'vscode'
import { addEventListener, copyText, getConfiguration, message, registerCommand, updateText } from '@vscode-use/utils'
import { CssToTailwindcssProcess } from './process'
import { LRUCache, getMultipedTailwindcssText, hasFile } from './utils'
// 'use strict'

// let config = null
// 插件被激活时调用activate
const cacheMap = new LRUCache(5000)
// todo: 如果当前html中已有class或className则合并进去
export async function activate(context: vscode.ExtensionContext) {
  // 如果当前环境中有 tailwind.config.js才激活
  const isTailwindcssEnv = await hasFile(['**/tailwind.config.js', '**/tailwind.config.ts'])

  if (!isTailwindcssEnv)
    return

  let copyClass = ''
  let copyClassRem = ''
  const styleReg = /style="([^"]+)"/
  const { dark, light } = getConfiguration('to-tailwindcss')
  const process = new CssToTailwindcssProcess()
  const LANS = ['html', 'vue', 'javascriptreact', 'typescriptreact', 'svelte', 'solid', 'swan', 'react', 'js', 'ts', 'tsx', 'jsx', 'wxml', 'axml', 'css', 'wxss', 'acss', 'less', 'scss', 'sass', 'stylus', 'wxss', 'acss']
  const md = new vscode.MarkdownString()
  md.isTrusted = true
  md.supportHtml = true
  // style
  const style = {
    dark: Object.assign({
      textDecoration: 'underline',
      backgroundColor: 'rgba(144, 238, 144, 0.5)',
      color: 'black',
    }, dark),
    light: Object.assign({
      textDecoration: 'underline',
      backgroundColor: 'rgba(255, 165, 0, 0.5)',
      color: '#ffffff',
      borderRadius: '6px',
    }, light),
  }
  const disposes = []

  const decorationType = vscode.window.createTextEditorDecorationType(style)

  // 注册ToTailwindcss命令
  disposes.push(registerCommand('totailwind.ToTailwindcss', async (textEditor) => {
    const doc = textEditor.document
    const isJsx = doc.languageId === 'typescriptreact'
    const fileName = doc.fileName
    const start = new vscode.Position(0, 0)
    const end = new vscode.Position(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length)
    // 获取全部文本区域
    const selection = new vscode.Range(start, end)
    const text = doc.getText(selection)
    // 替换文件内容
    const newSelection = await process.convertAll(text, fileName, isJsx)
    if (!newSelection)
      return
    updateText((builder: any) => {
      builder.replace(selection, newSelection)
    })
  }))

  // 注册InlineStyleToTailwindcss命令
  disposes.push(vscode.commands.registerTextEditorCommand('totailwind.InlineStyleToTailwindcss', async (textEditor) => {
    const doc = textEditor.document
    const isJsx = doc.languageId === 'typescriptreact'
    let selection: vscode.Selection | vscode.Range = textEditor.selection
    // 获取选中区域
    if (selection.isEmpty) {
      const start = new vscode.Position(0, 0)
      const end = new vscode.Position(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length)
      selection = new vscode.Range(start, end)
    }
    const text = doc.getText(selection)
    const newSelection = await process.convert(text, isJsx)
    if (!newSelection)
      return
    // 替换文件内容
    updateText((builder) => {
      builder.replace(selection, newSelection)
    })
  }))

  context.subscriptions.push(vscode.window.onDidChangeTextEditorVisibleRanges(() => {
    // 移除装饰器
    if (vscode.window.activeTextEditor)
      vscode.window.activeTextEditor.setDecorations(decorationType, [])
  }))

  // copy
  disposes.push(registerCommand('totailwind.copyClass', () => {
    copyText(copyClass)
    message.info('copy successfully')
  }))
  disposes.push(registerCommand('totailwind.copyClassRem', () => {
    copyText(copyClassRem)
    message.info('copy successfully')
  }))

  // 注册hover事件
  disposes.push(vscode.languages.registerHoverProvider(LANS, {
    provideHover(document, position) {
      // 获取当前选中的文本范围
      const editor = vscode.window.activeTextEditor
      if (!editor)
        return
      // 移除样式
      vscode.window.activeTextEditor?.setDecorations(decorationType, [])
      const selection = editor.selection
      const wordRange = new vscode.Range(selection.start, selection.end)
      let selectedText = editor.document.getText(wordRange)
      const realRangeMap: any = []
      if (!selectedText) {
        const range = document.getWordRangeAtPosition(position) as any
        let word = document.getText(range)
        const line = range.c.c
        const lineNumber = position.line
        const lineText = document.lineAt(lineNumber).text
        const styleMatch = word.match(styleReg)
        if (styleMatch) {
          word = styleMatch[1]
          const index = styleMatch.index!
          realRangeMap.push({
            content: styleMatch[0],
            range: new vscode.Range(
              new vscode.Position(line, index!),
              new vscode.Position(line, index! + styleMatch[1].length),
            ),
          })
        }
        else {
          // 可能存在多项，查找离range最近的
          if (lineText.indexOf(':') < 1)
            return
          const wholeReg = new RegExp(`([\\w\\-]+\\s*:\\s)?([\\w\\-\\[\\(\\!]+)?${word}(:*\\s*[^:"}{\`;\\/>]+)?`, 'g')
          for (const match of lineText.matchAll(wholeReg)) {
            const { index } = match
            const tag = match[0].indexOf(',')
            if (tag !== -1 && (!match[0].slice(0, tag).includes('[') || !match[0].slice(tag).includes(']')))
              match[0] = match[0].slice(0, tag)

            const pos = index! + match[0].indexOf(word)
            if (pos === range?.c?.e) {
              word = match[0]
              realRangeMap.push({
                content: match[0],
                range: new vscode.Range(
                  new vscode.Position(line, index!),
                  new vscode.Position(line, index! + match[0].length),
                ),
              })
              break
            }
          }
        }
        selectedText = word.replace(/'/g, '').trim()
      }

      // 获取当前选中的文本内容
      if (!selectedText || !/[\w\-]+\s*:[^.]+/.test(selectedText) || /[\|\?]/.test(selectedText))
        return
      if (cacheMap.has((selectedText)))
        return setStyle(editor, realRangeMap, cacheMap.get(selectedText))
      const selectedUnocssText = getMultipedTailwindcssText(selectedText)
      if (!selectedUnocssText)
        return
      // 设置缓存
      cacheMap.set(selectedText, selectedUnocssText)

      return setStyle(editor, realRangeMap, selectedUnocssText)
    },
  }))

  // 监听编辑器选择内容变化的事件
  disposes.push(addEventListener('text-change', () => vscode.window.activeTextEditor?.setDecorations(decorationType, [])))

  context.subscriptions.push(...disposes)
  function setStyle(editor: vscode.TextEditor, realRangeMap: any[], selectedUnocssText: string) {
    // 增加decorationType样式
    editor.edit(() => editor.setDecorations(decorationType, realRangeMap.map((item: any) => item.range)))
    md.value = ''
    copyClass = selectedUnocssText
    copyClassRem = selectedUnocssText.replace(
      /-\[([0-9\.]+)px\]/,
      (_: string, v: string) => `-[${+v / 16}rem]`,
    )
    const copyIcon = '<img width="12" height="12" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UyOWNkMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2Utd2lkdGg9IjEuNSI+PHBhdGggZD0iTTIwLjk5OCAxMGMtLjAxMi0yLjE3NS0uMTA4LTMuMzUzLS44NzctNC4xMjFDMTkuMjQzIDUgMTcuODI4IDUgMTUgNWgtM2MtMi44MjggMC00LjI0MyAwLTUuMTIxLjg3OUM2IDYuNzU3IDYgOC4xNzIgNiAxMXY1YzAgMi44MjggMCA0LjI0My44NzkgNS4xMjFDNy43NTcgMjIgOS4xNzIgMjIgMTIgMjJoM2MyLjgyOCAwIDQuMjQzIDAgNS4xMjEtLjg3OUMyMSAyMC4yNDMgMjEgMTguODI4IDIxIDE2di0xIi8+PHBhdGggZD0iTTMgMTB2NmEzIDMgMCAwIDAgMyAzTTE4IDVhMyAzIDAgMCAwLTMtM2gtNEM3LjIyOSAyIDUuMzQzIDIgNC4xNzIgMy4xNzJDMy41MTggMy44MjUgMy4yMjkgNC43IDMuMTAyIDYiLz48L2c+PC9zdmc+" />'
    md.appendMarkdown('<a href="https://github.com/Simon-He95/totailwind">To Tailwindcss:</a>\n')
    md.appendMarkdown(`\n<a href="command:totailwind.copyClass" style="display:flex;align-items:center;gap:5px;"> ${selectedUnocssText} ${copyIcon}</a>\n`)
    md.appendMarkdown(`\n<a href="command:totailwind.copyClassRem" style="display:flex;align-items:center;gap:5px;"> ${copyClassRem} ${copyIcon}</a>\n`)
    return new vscode.Hover(md)
  }
}

// this method is called when your totailwind is deactivated
export function deactivate() {
  cacheMap.clear()
}
