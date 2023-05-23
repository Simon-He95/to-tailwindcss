import { transfromCode } from 'transform-to-tailwindcss'
import { getCssType, getMultipedTailwindcssText } from './utils'

export class CssToTailwindcssProcess {
  /**
     * transform px to rpx
     *
     * @param {string} code origin text
     * @return {string} transformed text
     */
  convert(text: string, isJsx: boolean) {
    const tailwindcss = getMultipedTailwindcssText(text)
    if (!tailwindcss)
      return ''
    return `${isJsx ? 'className' : 'class'}="${tailwindcss}"`
  }

  /**
     * transform all px to rpx
     *
     * @param {string} code origin text
     * @return {string} transformed text
     */
  async convertAll(code: string, fileName: string, isJsx: boolean): Promise<string> {
    if (!code)
      return code
    const type = getCssType(fileName)
    const tailwindcss = (await transfromCode(code, fileName, type as any))
    if (!tailwindcss)
      return ''

    return `${isJsx ? 'className' : 'class'}="${tailwindcss}"`
  }
}
