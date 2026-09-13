import * as Confbox from 'confbox'
import htmlTagsArray from 'html-tags'
import type { BlockContent, DefinitionContent, Paragraph, PhrasingContent } from 'mdast'
import {
  defineMdastPlugin,
  type MdastPluginDefinition,
  type MdxJsxAttributeNode,
  type MdxJsxExpressionAttributeNode,
  type MdxJsxFlowElement,
  type MdxJsxTextElement,
} from 'satteri'
import { pascalCase } from 'tiny-case'
import { u } from 'unist-builder'
import { shouldBeEvalString, splitParagraph, wrapOne } from './util'

export type BlockLevelContent = BlockContent | DefinitionContent

export type SlotContents =
  { type: 'inline'; contents: PhrasingContent[] } | { type: 'block'; contents: BlockLevelContent[] }

export interface Options {
  /**
   * Function for normalizing element names. Pass a no-op function to disable this behavior.
   * @default htmlOrPascalCase
   */
  normalizeCase?: (name: string) => string

  /**
   * Support bindings (arbitrary expressions) in props via the `:prop="expr"` syntax, as well as
   * the `::` and `...` prop names for expressions to be used as spread props.
   * @default true
   */
  bindings?: boolean

  /**
   * How to parse `[props]` code blocks in the given languages. Pass a `null` to disable parsing of
   * props blocks.
   * @default viaConfbox
   */
  propsBlocks?: Record<string, (input: string) => unknown> | null

  /**
   * Enable `[script]` code blocks
   * @default true
   */
  scriptBlocks?: boolean

  /**
   * Enable `[embed]` code blocks
   * @default true
   */
  embedBlocks?: boolean

  /**
   * Define slot support in container directives. Pass a `null` to disable parsing of slots.
   * @default passthrough
   */
  slots?: ((name: string, children: SlotContents) => BlockLevelContent | BlockLevelContent[]) | null

  /**
   * Define how to parse labels in container directives.
   * @default this.slots ?? passthrough
   */
  labels?: (
    name: 'label',
    children: { type: 'inline'; contents: PhrasingContent[] },
  ) => BlockLevelContent | BlockLevelContent[]
}

const htmlTags = new Set(htmlTagsArray as string[])

/**
 * Default value for `Options.normalizeCase`. If element name is a valid HTML tag, it will be
 * converted to lowercase. Otherwise, it will be converted to PascalCase.
 */
export function htmlOrPascalCase(name: string): string {
  if (htmlTags.has(name.toLowerCase())) return name.toLowerCase()
  return pascalCase(name)
}

/**
 * Default value for `Options.propsBlocks`. Uses the `confbox` library to parse the following
 * languages: JSON5, JSON with comments (JSONC), YAML, JSON, TOML, and INI.
 */
export const viaConfbox: Record<string, (input: string) => unknown> = {
  json5: Confbox.parseJSON5,
  jsonc: Confbox.parseJSONC,
  yaml: Confbox.parseYAML,
  json: Confbox.parseJSON,
  toml: Confbox.parseTOML,
  ini: Confbox.parseINI,
}

/**
 * Default value for `Options.slots`. Passes through the slot contents as-is and discards the slot
 * name.
 */
export function passthrough(_name: string, children: SlotContents): BlockLevelContent[] {
  if (children.type === 'inline') {
    return [u('paragraph', children.contents)]
  } else {
    return children.contents
  }
}

/**
 * Can be passed to `Options.slots` or `Options.labels` to discard parsed contents.
 */
export function discard(_name: string, _children: SlotContents): BlockLevelContent[] {
  return []
}

/**
 * Value for `Options.slots` suitable for the Astro framework. Converts slots into slotted JSX
 * fragments:
 *
 * ```jsx
 * <Fragment slot="[slotName]">
 *   <... slot content ...>
 * </Fragment>
 * ```
 */
export function astroFragment(name: string, children: SlotContents): BlockLevelContent {
  return u(
    'mdxJsxFlowElement',
    {
      name: 'Fragment',
      attributes: [u('mdxJsxAttribute', { name: 'slot' }, name)],
    },
    children.contents as BlockLevelContent[],
  )
}

function makeAttrs(
  attrs: Record<string, string | null | undefined> | null | undefined,
  bindings: boolean,
): (MdxJsxAttributeNode | MdxJsxExpressionAttributeNode)[] {
  return Object.entries(attrs ?? {}).map(([name, value]) => {
    if (bindings && (name === '...' || name === '::'))
      return u('mdxJsxExpressionAttribute', `...(${shouldBeEvalString(value)})`)

    if (bindings && name.startsWith(':'))
      return u('mdxJsxAttribute', {
        name: name.slice(1),
        value: u('mdxJsxAttributeValueExpression', shouldBeEvalString(value)),
      })

    if (typeof value === 'string') {
      return u('mdxJsxAttribute', { name, value })
    }

    return u('mdxJsxAttribute', {
      name,
      value: u('mdxJsxAttributeValueExpression', JSON.stringify(value)),
    })
  })
}

function parseSlots(
  makeSlot: (name: string, children: SlotContents) => BlockLevelContent | BlockLevelContent[],
  children: BlockLevelContent[],
): BlockLevelContent[] {
  const newChildren: BlockLevelContent[] = []
  let slotName: string | null = null
  let inside: SlotContents = { type: 'inline', contents: [] }

  const pushBlock = (block: BlockLevelContent) => {
    if (inside.type === 'block') inside.contents.push(block)
    else
      inside = {
        type: 'block',
        contents: [...(inside.contents.length ? [u('paragraph', inside.contents)] : []), block],
      }
  }

  const pushInlines = (content: PhrasingContent[]) => {
    if (content.length === 0) return

    if (inside.type === 'block') inside.contents.push(u('paragraph', content))
    else inside.contents.push(...content)
  }

  const commitSlot = () => {
    if (inside.contents.length === 0) return

    if (slotName) newChildren.push(...wrapOne(makeSlot(slotName, inside)))
    else newChildren.push(...passthrough('', inside))
  }

  for (let blockIx = 0; blockIx < children.length; blockIx++) {
    const block = children[blockIx]
    if (block.type !== 'paragraph') {
      pushBlock(block)
      continue
    }

    const split = splitParagraph(block, line => /^#\S/.test(line))
    if (!split) {
      pushBlock(block)
      continue
    }

    const [before, target, after] = split
    pushInlines(before)
    commitSlot()
    slotName = target.slice(1)
    inside = { type: 'inline', contents: [] }
    pushInlines(after)
  }
  commitSlot()

  return newChildren
}

/**
 * This Satteri plugin provides support for most of the Comark components syntax by translating
 * them into MDX.
 *
 * Note that the two-colon container syntax isn't provided by this plugin, but instead by
 * `satteri-comark/2colons`, which must be placed _before_ this plugin if you wish to use
 * two-colon containers.
 *
 * There are some divergences from Comark:
 * - Prop bindings `:prop="value"` are arbitrary JavaScript expressions, which makes them more
 *   flexible than Comark's JSON values/property paths.
 * - You can spread props by setting the `::` or `...` prop to a JavaScript expression evaluating
 *   to the object you wish to spread.
 * - `[props]` blocks support more languages by default (JSON5, JSONC, YAML, JSON, TOML, and INI).
 * - `[props]` blocks must be code blocks, not frontmatter.
 * - You can embed MDX `import/export` statements with ```` ```jsx|tsx [script] ```` code blocks.
 * - You can embed JSX expressions with ```` ```jsx|tsx [embed] ```` code blocks.
 * - Curly braces in bindings need to be escaped. This is a Satteri bug.
 * - This plugin doesn't handle the setup of binding namespaces like `frontmatter`, `data`, etc.
 */
export default ({
  normalizeCase = htmlOrPascalCase,
  bindings = true,
  propsBlocks = viaConfbox,
  scriptBlocks = true,
  embedBlocks = true,
  slots = passthrough,
  labels = slots ?? passthrough,
}: Options = {}): MdastPluginDefinition =>
  defineMdastPlugin({
    name: 'comark-mdx',
    code(node) {
      if (scriptBlocks && node.meta?.trim() === '[script]') {
        return u('mdxjsEsm', node.value)
      }
      if (embedBlocks && node.meta?.trim() === '[embed]') {
        return u('mdxFlowExpression', node.value)
      }
    },
    containerDirective(node, ctx) {
      const label = node.children.find(
        (child): child is Paragraph => !!(child.data && 'directiveLabel' in child.data),
      )
      let attributes = node.attributes
      let children = node.children.filter(child => !(child.data && 'directiveLabel' in child.data))

      if (
        propsBlocks &&
        children.length > 0 &&
        children[0].type === 'code' &&
        children[0].meta?.trim() === '[props]' &&
        children[0].lang &&
        children[0].lang in propsBlocks
      ) {
        const props = children[0]
        const lang = children[0].lang
        const parsed = propsBlocks[lang](props.value)
        if (typeof parsed !== 'object' || parsed === null) {
          ctx.report({
            node: props,
            severity: 'warning',
            message: `Invalid parsed value for props block: ${props.value}. This is ignored.`,
          })
          console.warn(`Invalid parsed value for props block: ${props.value}. This is ignored.`)
        } else {
          attributes = { ...attributes, ...parsed }
        }
        children.shift()
      }

      if (slots) children = parseSlots(slots, children)

      if (label)
        children.unshift(...wrapOne(labels('label', { type: 'inline', contents: label.children })))

      return u(
        'mdxJsxFlowElement',
        {
          name: normalizeCase(node.name),
          attributes: makeAttrs(attributes, bindings),
          data: node.data,
        },
        children as (BlockContent | DefinitionContent)[],
      ) satisfies MdxJsxFlowElement
    },
    leafDirective(node) {
      return u(
        'mdxJsxFlowElement',
        {
          name: normalizeCase(node.name),
          attributes: makeAttrs(node.attributes, bindings),
          data: node.data,
        },
        node.children as (BlockContent | DefinitionContent)[],
      ) satisfies MdxJsxFlowElement
    },
    textDirective(node) {
      return u(
        'mdxJsxTextElement',
        {
          name: normalizeCase(node.name),
          attributes: makeAttrs(node.attributes, bindings),
          data: node.data,
        },
        node.children,
      ) satisfies MdxJsxTextElement
    },
  })
