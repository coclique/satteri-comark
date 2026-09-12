import type { BlockContent, DefinitionContent, Parent, RootContent } from 'mdast'
import {
  defineMdastPlugin,
  type MdastNode,
  type MdastPluginDefinition,
  type MdastVisitorContext,
} from 'satteri'
import { u } from 'unist-builder'
import { omit, splitParagraph, type ContainerDirective, type LeafDirective } from './util'

export interface Options {
  /**
   * Behavior when encoutering an unterminated 2-colon directive.
   *
   * - `'error'`: Throw an error.
   * - `'greedy'`: Assume the directive extends as far as possible, until the next 2-colon
   *   directive or the end of its parent element.
   * - `'self-closing'`: Treat the directive as self-closing; no content is contained inside. Note
   *    that this recovers the classical behavior of "leaf directives".
   * @default 'self-closing'
   */
  onUnterminated?: 'error' | 'greedy' | 'self-closing'
}

const visit =
  ({ onUnterminated = 'self-closing' }: Options) =>
  <U extends MdastNode & Parent>(node: U, ctx: MdastVisitorContext): void => {
    const newChildren: RootContent[] = []

    let start: LeafDirective | null = null
    let inside: RootContent[] = []

    let commit = (terminated: boolean) => {
      if (start) {
        if (!terminated && onUnterminated === 'error') {
          throw new Error(`Unterminated directive: ${start.name}`)
        } else if (!terminated && onUnterminated === 'self-closing') {
          newChildren.push(start)
        } else /* terminated || onUnterminated === 'greedy' */ {
          newChildren.push(
            u('containerDirective', omit(start, 'type'), [
              ...(start.children.length
                ? [u('paragraph', { data: { directiveLabel: true } }, start.children)]
                : []),
              ...(inside as (BlockContent | DefinitionContent)[]),
            ]) satisfies ContainerDirective,
          )
          inside = []
        }
      }
      newChildren.push(...inside)
    }

    for (let blockIx = 0; blockIx < node.children.length; blockIx++) {
      const block = node.children[blockIx]

      if (block.type === 'leafDirective') {
        commit(false)
        start = block
        inside = []
      } else if (start && block.type === 'paragraph') {
        const split = splitParagraph(block, line => line === '::')
        if (!split) {
          inside.push(block)
          continue
        }

        const [before, _, after] = split
        inside.push(...(before.length ? [u('paragraph', before)] : []))
        commit(true)
        start = null
        inside = after.length ? [u('paragraph', after)] : []
      } else {
        inside.push(block)
      }
    }
    commit(false)

    ctx.replaceNode(node, { ...node, children: newChildren } as U)
  }

/**
 * This Satteri plugin allows for container directives using two colons, instead of three at
 * minimum:
 *
 * ```md
 * ::container
 * ... content ...
 * ::
 * ```
 *
 * Note that this plugin doesn't change that each nesting level of container directives must have
 * _distinct_ numbers of colons. This is a limitation of `pulldown-cmark` that we cannot work
 * around. For example, the following input would still parse nonsensically:
 *
 * ```md
 * ::container
 * ::container-2
 * :::container-3
 * :::container-4
 * :::
 * :::
 * ::
 * ::
 * ```
 *
 * As opposed to this, which parses correctly:
 *
 * ```md
 * ::container
 * :::::container-2
 * :::container-3
 * ::::container-4
 * ::::
 * :::
 * :::::
 * ::
 * ```
 *
 * Of special note here is that the number of colons need not be strictly increasing or decreasing.
 */
export default (opts: Options = {}): MdastPluginDefinition =>
  defineMdastPlugin({
    name: 'directive-2-colons',
    before: visit(opts),
    blockquote: visit(opts),
    listItem: visit(opts),
    footnoteDefinition: visit(opts),
    containerDirective: visit(opts),
    descriptionDetails: visit(opts),
    mdxJsxFlowElement: visit(opts),
  })
