import dedent from 'dedent'
import { format } from 'prettier'
import { mdxToJs, type MdxCompileOptions } from 'satteri'
import * as ComarkMdx from '.'
import * as TwoColons from './2colons'

export const parser =
  (opts: TwoColons.Options & ComarkMdx.Options = {}) =>
  async (
    str: string,
    {
      full = false,
      raw = false,
      ...compileOpts
    }: MdxCompileOptions & { full?: boolean; raw?: boolean } = {},
  ): Promise<string> => {
    const result = await mdxToJs(str, {
      mdastPlugins: [TwoColons.default(opts), ComarkMdx.default(opts)],
      features: {
        directive: true,
        math: true,
      },
      jsx: true,
      outputFormat: 'function-body',
      elementAttributeNameCase: 'html',
      ...compileOpts,
    })
    // Prettier cannot parse deliberately-invalid output (e.g. `bindings: false` emits props whose
    // names aren't valid JSX identifiers), so `raw` skips formatting entirely.
    if (raw) return result.code
    const formatted = await format(result.code, {
      parser: 'babel',
    })
    return full
      ? formatted
      : dedent(
          formatted
            .split('function MDXContent')[0]
            .split('/*@jsxImportSource react*/')[1]
            .replaceAll('_components.', '')
            .split('return ')[1]
            .split(/\;\s*\}/gm)
            .slice(0, -1)
            .join(';}'),
        )
  }
