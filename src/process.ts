// import { transfromCode } from 'transform-to-tailwindcss'
import { getCssType, getMultipedTailwindcssText } from './utils'

export class CssToTailwindcssProcess {
  /**
   * transform px to rpx
   *
   * @param {string} text origin
   * @param {boolean} isJsx
   * @return {string}
   */
  convert(text: string, isJsx: boolean): string {
    const tailwindcss = getMultipedTailwindcssText(text)
    if (!tailwindcss)
      return ''
    return `${isJsx ? 'className' : 'class'}="${tailwindcss}"`
  }

  /**
   * transform all page to tailwindcss
   *
   * @param {string} code origin
   * @param {string} filepath
   */
  async convertAll(code: string, filepath: string): Promise<string> {
    if (!code)
      return code
    const type = getCssType(filepath) as any
    const { transfromCode } = await import('transform-to-tailwindcss')

    return await transfromCode(code, { filepath, type })
  }
}
