import type { ExtensionContext } from 'vscode'
import { CreateWebview } from '@vscode-use/createwebview'
import { registerCommand } from '@vscode-use/utils'
import * as vscode from 'vscode'

export function openTailwindPlayground(context: ExtensionContext) {
  // webview 文档
  context.subscriptions.push(registerCommand('totailwind.openTailwindPlayground', () => {
    const title = 'tailwindcss playground'
    const provider = new CreateWebview(context.extensionUri, {
      title,
      scripts: ['main.js'],
      viewColumn: vscode.ViewColumn.Beside,
    })
    const url = 'https://play.tailwindcss.com/'
    provider.create(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body{
              width:100%;
              height:100vh;
            }
          </style>
        </head>
        <body>
          <iframe id="tailwind-documentation" src="${url}" width="100%" height="100%"></iframe>
        </body>
      </html>
      `, ({ data, type }) => {
      // callback 获取js层的postMessage数据
      if (type === 'copy') {
        vscode.env.clipboard.writeText(data).then(() => {
          vscode.window.showInformationMessage('复制成功!  ✅')
        })
      }
    })
  }))
}
