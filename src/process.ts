import { transfromCode } from 'transform-to-tailwindcss'
import { getCssType, getMultipedTailwindcssText } from './utils'

export class CssToTailwindcssProcess {
  /**
     * transform px to rpx
     *
     * @param {string} code origin text
     * @return {string} transformed text
     */
  convert(text: string) {
    return getMultipedTailwindcssText(text) ?? text
  }

  /**
     * transform all px to rpx
     *
     * @param {string} code origin text
     * @return {string} transformed text
     */
  async convertAll(code: string, fileName: string): Promise<string> {
    if (!code)
      return code
    const type = getCssType(fileName)
    const unocss = (await transfromCode(code, fileName, type as any)) ?? code
    return unocss
  }
}
