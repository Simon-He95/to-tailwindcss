import * as vscode from 'vscode'
import { CssToTailwindcssProcess } from './process'
import { LRUCache, getMultipedTailwindcssText, hasFile } from './utils'
// 'use strict'

// let config = null
// 插件被激活时调用activate
const cacheMap = new LRUCache(500)
// todo: 如果当前html中已有class或className则合并进去
export async function activate(context: vscode.ExtensionContext) {
  // 如果当前环境中有 tailwind.config.js才激活
  const isTailwindcssEnv = await hasFile('tailwind.config.js')

  if (!isTailwindcssEnv)
    return

  const styleReg = /style="([^"]+)"/
  const { dark, light } = vscode.workspace.getConfiguration('to-tailwindcss')
  const process = new CssToTailwindcssProcess()
  const LANS = ['html', 'vue', 'svelte', 'solid', 'swan', 'react', 'js', 'ts', 'tsx', 'jsx', 'wxml', 'axml', 'css', 'wxss', 'acss', 'less', 'scss', 'sass', 'stylus', 'wxss', 'acss']
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
  const decorationType = vscode.window.createTextEditorDecorationType(style)

  // 注册ToTailwindcss命令
  vscode.commands.registerTextEditorCommand('extension.ToTailwindcss', async (textEditor) => {
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
    textEditor.edit((builder) => {
      builder.replace(selection, newSelection)
    })
  })

  // 注册InlineStyleToTailwindcss命令
  const disposable = vscode.commands.registerTextEditorCommand('extension.InlineStyleToTailwindcss', async (textEditor) => {
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
    textEditor.edit((builder) => {
      builder.replace(selection, newSelection)
    })
  })

  // 注册hover事件
  setTimeout(() => {
    vscode.languages.registerHoverProvider(LANS, {
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
        if (!selectedText || !/[\w\-]+\s*:[^.]+/.test(selectedText))
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
    })
  }, 500)

  // 监听编辑器选择内容变化的事件
  vscode.window.onDidChangeTextEditorSelection(() => vscode.window.activeTextEditor?.setDecorations(decorationType, []))

  context.subscriptions.push(disposable)
  function setStyle(editor: vscode.TextEditor, realRangeMap: any[], selectedUnocssText: string) {
    // 增加decorationType样式
    editor.edit(() => editor.setDecorations(decorationType, realRangeMap.map((item: any) => item.range)))
    md.value = ''
    md.appendMarkdown('<a href="https://github.com/Simon-He95/ToTailwindcss">To Unocss:</a>\n')
    md.appendCodeblock(selectedUnocssText, 'js')
    return new vscode.Hover(md)
  }
}

// this method is called when your extension is deactivated
export function deactivate() {
}
