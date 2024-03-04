import * as vscode from 'vscode'
import { addEventListener, createPosition, createStyle, getActiveText, getActiveTextEditor, getActiveTextEditorLanguageId, getConfiguration, getCopyText, getLineText, getLocale, getSelection, message, registerCommand, setCopyText, updateText } from '@vscode-use/utils'
import { transformStyleToTailwindcss } from 'transform-to-tailwindcss-core'
import { CssToTailwindcssProcess } from './process'
import { LRUCache, getMultipedTailwindcssText, hasFile } from './utils'
import { parser } from './parser'
import { openPlayground } from './openPlayground'
import { openTailwindPlayground } from './openTailwindPlayground'

// 'use strict'

// let config = null
// 插件被激活时调用activate
const cacheMap = new LRUCache(5000)
// todo: 如果当前html中已有class或className则合并进去
export async function activate(context: vscode.ExtensionContext) {
  // 如果当前环境中有 tailwind.config.js才激活
  const isTailwindcssEnv = await hasFile(['**/tailwind.config.js', '**/tailwind.config.ts'])

  openPlayground(context)
  openTailwindPlayground(context)

  // 注册快捷指令
  context.subscriptions.push(registerCommand('totailwind.transform', async () => {
    if (!isTailwindcssEnv)
      return
    const { line, character, lineText } = getSelection()!
    const copyText = (await getCopyText()).trim()
    if (!copyText)
      return
    const locale = getLocale()
    const isZh = locale.includes('zh')
    let pre = character - 1
    let prefixName = ''
    while (pre > 0 && (lineText[pre] !== '"' || lineText[pre - 1] !== '=') && (lineText[pre] !== '{' || lineText[pre - 1] !== '=')) {
      if ((lineText[pre] === '>' || lineText[pre] === '"') && lineText[pre - 1] !== '=') {
        prefixName = ''
        break
      }
      pre--
    }

    if (lineText[--pre] === '=') {
      pre--
      while (pre > 0 && !(/[\s'"><\/]/.test(lineText[pre]))) {
        prefixName = `${lineText[pre]}${prefixName}`
        pre--
      }
    }

    const [transferred, noTransferred] = transformStyleToTailwindcss(copyText)
    const lan = getActiveTextEditorLanguageId()!
    let result = ''
    if (prefixName === 'class' || prefixName === 'className')
      result = transferred
    else
      result = `${['javascriptreact', 'typescriptreact'].includes(lan) ? 'className' : 'class'}="${transferred}"`

    if (noTransferred.length)
      message.error(`${isZh ? '⚠️ 有一些属性to-tailwindcss暂时还不支持转换，请自行处理：' : '⚠️ Some attributes to-tailwindcss do not support conversion for the time being, please deal with them by yourself: '}${noTransferred.join('; ')}`)

    updateText((builder) => {
      builder.insert(new vscode.Position(line, character), result)
    })

    message.info(`${isZh ? '🎉 转换成功：' : '🎉 Successful conversion: '}${transferred}`)
  }))

  if (!isTailwindcssEnv)
    return

  let copyClass = ''
  let copyClassRem = ''
  let copyRange: any = null
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

  const decorationType = createStyle(style)

  // 注册ToTailwindcss命令
  disposes.push(registerCommand('totailwind.ToTailwind', async () => {
    const textEditor = getActiveTextEditor()
    if (!textEditor)
      return
    const doc = textEditor.document
    const fileName = doc.fileName
    const start = createPosition(0, 0)
    const end = createPosition(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length)
    // 获取全部文本区域
    const selection = new vscode.Range(start, end)
    const text = doc.getText(selection)
    // 替换文件内容
    const newSelection = await process.convertAll(text, fileName)
    if (!newSelection)
      return
    updateText((builder: any) => {
      builder.replace(selection, newSelection)
    })
  }))

  // 注册InlineStyleToTailwindcss命令
  disposes.push(registerCommand('totailwind.InlineStyleToTailwindcss', async () => {
    if (!isTailwindcssEnv) {
      message.error('当前非tailwind环境，无法使用此命令')
      return
    }
    const textEditor = getActiveTextEditor()
    if (!textEditor)
      return
    const doc = textEditor.document
    const isJsx = getActiveTextEditorLanguageId() === 'typescriptreact'
    let selection: vscode.Selection | vscode.Range = textEditor.selection
    // 获取选中区域
    if (selection.isEmpty) {
      const start = createPosition(0, 0)
      const end = createPosition(doc.lineCount - 1, doc.lineAt(doc.lineCount - 1).text.length)
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
  context.subscriptions.push(addEventListener('text-visible-change', () => {
    // 移除装饰器
    getActiveTextEditor()?.setDecorations(decorationType, [])
  }))

  function replaceStyleToAttr(text: string) {
    let item: any
    let isRemoveAfter = false
    if (copyRange?.length) {
      // 如果最后一位的后面跟着; 则end+1
      const afterChar = getLineText(copyRange[0].range.end.line)![copyRange[0].range.end.character]
      isRemoveAfter = afterChar === ';'
      item = {
        range: copyRange[0].range,
      }
    }
    else {
      item = {
        range: getActiveTextEditor()!.selection,
      }
    }

    const ast = parser(getActiveText()!, item.range.start)
    if (ast?.tag) {
      const propClass = ast.props?.find((i: any) => i.name === (ast.isJsx ? 'className' : 'class'))
      if (propClass) {
        updateText((edit) => {
          edit.insert(createPosition(propClass.value.loc.start.line - 1, propClass.value.loc.start.column), propClass.value.content ? `${text} ` : text)
          edit.replace(updateRange(item.range), '')
        })
      }
      else if (ast.props?.length > 1) {
        const pos = ast.props.find((i: any) => i.name !== 'style')!.loc
        updateText((edit) => {
          edit.insert(createPosition(pos.start.line - 1, pos.start.column - 1), `${ast.isJsx ? 'className' : 'class'}="${text}" `)
          edit.replace(updateRange(item.range), '')
        })
      }
      else {
        const pos = {
          line: ast.loc.start.line,
          column: ast.loc.start.column + ast.tag.length + 1,
          offset: ast.loc.start.offset + ast.tag.length + 1,
        }
        updateText((edit) => {
          edit.insert(createPosition(pos.line - 1, pos.column), `${ast.isJsx ? 'className' : 'class'}="${text}" `)
          edit.replace(updateRange(item.range), '')
        })
      }
    }
    else {
      updateText((edit) => {
        edit.replace(updateRange(item.range), text)
      })
    }

    function updateRange(range: any) {
      if (!isRemoveAfter)
        return range
      return new vscode.Range(createPosition(range.start.line, range.start.character), createPosition(range.end.line, range.end.character + 1))
    }
  }

  // copy
  disposes.push(registerCommand('totailwind.copyClass', () => {
    setCopyText(copyClass)
    replaceStyleToAttr(copyClass)
  }))

  disposes.push(registerCommand('totailwind.copyClassRem', () => {
    setCopyText(copyClassRem)
    // 将当前鼠标位置的文本替换为转换后的文本
    replaceStyleToAttr(copyClassRem)
  }))

  // 注册hover事件
  disposes.push(vscode.languages.registerHoverProvider(LANS, {
    provideHover(document, position) {
      // 获取当前选中的文本范围
      const editor = getActiveTextEditor()
      if (!editor)
        return
      // 移除样式
      editor.setDecorations(decorationType, [])
      const selection = editor.selection
      const wordRange = new vscode.Range(selection.start, selection.end)
      let selectedText = editor.document.getText(wordRange)
      const realRangeMap: any = []
      if (!selectedText) {
        const range = document.getWordRangeAtPosition(position)
        if (!range)
          return
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
              createPosition(line, index!),
              createPosition(line, index! + styleMatch[1].length),
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
                  createPosition(line, index!),
                  createPosition(line, index! + match[0].length),
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
      const selectedCssText = getMultipedTailwindcssText(selectedText)
      if (!selectedCssText)
        return
      // 设置缓存
      cacheMap.set(selectedText, selectedCssText)

      return setStyle(editor, realRangeMap, selectedCssText)
    },
  }))

  // 监听编辑器选择内容变化的事件
  disposes.push(addEventListener('text-change', () => getActiveTextEditor()?.setDecorations(decorationType, [])))

  disposes.push(addEventListener('selection-change', () => getActiveTextEditor()?.setDecorations(decorationType, [])))

  context.subscriptions.push(...disposes)
  function setStyle(editor: vscode.TextEditor, realRangeMap: any[], selectedCssText: string) {
    // 增加decorationType样式
    editor.edit(() => editor.setDecorations(decorationType, realRangeMap.map((item: any) => item.range)))
    md.value = ''
    copyClass = selectedCssText
    copyClassRem = selectedCssText.replace(
      /-\[([0-9\.]+)px\]/,
      (_: string, v: string) => `-[${+v / 16}rem]`,
    )
    copyRange = realRangeMap
    const copyIcon = '<img width="12" height="12" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2UyOWNkMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2Utd2lkdGg9IjEuNSI+PHBhdGggZD0iTTIwLjk5OCAxMGMtLjAxMi0yLjE3NS0uMTA4LTMuMzUzLS44NzctNC4xMjFDMTkuMjQzIDUgMTcuODI4IDUgMTUgNWgtM2MtMi44MjggMC00LjI0MyAwLTUuMTIxLjg3OUM2IDYuNzU3IDYgOC4xNzIgNiAxMXY1YzAgMi44MjggMCA0LjI0My44NzkgNS4xMjFDNy43NTcgMjIgOS4xNzIgMjIgMTIgMjJoM2MyLjgyOCAwIDQuMjQzIDAgNS4xMjEtLjg3OUMyMSAyMC4yNDMgMjEgMTguODI4IDIxIDE2di0xIi8+PHBhdGggZD0iTTMgMTB2NmEzIDMgMCAwIDAgMyAzTTE4IDVhMyAzIDAgMCAwLTMtM2gtNEM3LjIyOSAyIDUuMzQzIDIgNC4xNzIgMy4xNzJDMy41MTggMy44MjUgMy4yMjkgNC43IDMuMTAyIDYiLz48L2c+PC9zdmc+" />'
    md.appendMarkdown('<a href="https://github.com/Simon-He95/to-tailwindcss">To Tailwindcss:</a>\n')
    md.appendMarkdown(`\n<a href="command:totailwind.copyClass" style="display:flex;align-items:center;gap:5px;"> ${selectedCssText} ${copyIcon}</a>\n`)
    if (selectedCssText !== copyClassRem)
      md.appendMarkdown(`\n<a href="command:totailwind.copyClassRem" style="display:flex;align-items:center;gap:5px;">PxToRem: ${copyClassRem} ${copyIcon}</a>\n`)
    return new vscode.Hover(md)
  }
}

// this method is called when your totailwind is deactivated
export function deactivate() {
  cacheMap.clear()
}
