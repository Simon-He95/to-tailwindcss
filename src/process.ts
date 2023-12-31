// import { transfromCode } from 'transform-to-tailwindcss'
import { getMultipedTailwindcssText } from './utils'

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
     * @param {string} fileName
     * @param {boolean} isJsx
     */
  // async convertAll(code: string, filepath: string, isJsx: boolean): Promise<string> {
  // if (!code)
  //   return code
  // const type = getCssType(filepath) as any
  // const tailwindcss = (await transfromCode(code, { filepath, type }))
  // if (!tailwindcss)
  //   return ''

  // return `${isJsx ? 'className' : 'class'}="${tailwindcss}"`
  // }
}
