import { format } from 'prettier'
import { mdxToJs } from 'satteri'
import * as ComarkMdx from '.'
import * as TwoColons from './2colons'

export const parser =
  (opts: TwoColons.Options & ComarkMdx.Options = {}) =>
  async (str: string, full: boolean = false): Promise<string> => {
    const result = await mdxToJs(str, {
      mdastPlugins: [TwoColons.default(opts), ComarkMdx.default(opts)],
      features: {
        directive: true,
      },
      jsx: true,
      elementAttributeNameCase: 'html',
    })
    const formatted = await format(result.code, {
      parser: 'babel',
    })
    return full
      ? formatted
      : formatted
          .split('function MDXContent')[0]
          .split('/*@jsxImportSource react*/')[1]
          .replaceAll('_components.', '')
          .split('return ')[1]
          .split(/\;\s*\}/gm)
          .slice(0, -1)
          .join(';}')
  }
