# satteri-comark

`satteri-comark` is a [Sätteri](https://satteri.bruits.org) plugin that adds support for most of [Comark](https://comark.dev)'s component syntax by transforming it into MDX.

## See an example

Take this scary example from Comark docs:

````md
::card{.featured}
```yaml [props]
variant: elevated
color: primary
actions:
  - label: Read More
    url: /article
  - label: Share
    icon: share
```
#header
## Article Title
*By Jane Doe*

#content
This is the main article content with **markdown** support.

#footer
Published on January 15, 2024
::
````

With `satteri-comark`, Sätteri transforms it into the following JSX output:

```jsx
<Card
  class="featured"
  variant="elevated"
  color="primary"
  actions={[
    {
      label: "Read More",
      url: "/article",
    },
    {
      label: "Share",
      icon: "share",
    },
  ]}
>
  <Fragment slot="header">
    <h2>{"Article Title"}</h2>
    <p>
      <em>{"By Jane Doe"}</em>
    </p>
  </Fragment>
  <Fragment slot="content">
    {"This is the main article content with "}
    <strong>{"markdown"}</strong>
    {" support."}
  </Fragment>
  <Fragment slot="footer">{"Published on January 15, 2024"}</Fragment>
</Card>
```

## Features

### What is supported

- Two-colon component syntax (`::component` can be a container)
- Translation of block components and inline components into MDX
- Data binding syntax (`:prop="expr"`)
- Block props inside code fences
- Named slots. You can customize what slots transform into, and this package includes an adapter for [Astro](https://astro.build).

### Extra features

- In addition to normal data bindings for props, you can specify an expression to spread by setting the prop with name `::` (more convenient for inline props) or `...` (more convenient for block props) to that expression. For example, `:component{::="\{prop: 'value'\}"}`.

- Block props support more languages by default, powered by [`confbox`](https://npmjs.com/package/confbox). Currently, in addition to YAML, JSON5, JSON with comments (JSONC), JSON, TOML, and INI are supported; just specify the language of the code block. You can also customize the behavior of prop blocks.

- You can embed MDX `import/export` statements with ```` ```jsx|tsx [script] ```` code blocks.

- You can embed JSX expressions with ```` ```jsx|tsx [embed] ```` code blocks.

### Divergences from Comark

In data bindings, values are just plain JS expressions (for example, you can do `:prop="arbitraryFunction()"`). This is more flexible than Comark.

On the other hand, the data binding namespaces that Comark provides (`frontmatter`, `meta`, `data`, `props`) aren't set up by this plugin, and you or your framework need to inject them into your MDX environment. For example, Astro provides the `frontmatter` variable to all MDX files.

### What is not supported

- Frontmatter-style block props are not supported because Sätteri cannot parse them.
- Nesting components must each have a distinct number of colons, otherwise Sätteri cannot parse them (bruits/satteri#203).
- You must escape curly braces in inline props. This is due to a Sätteri bug (bruits/satteri#301).
- Other Comark extensions, such as admonitions (there are separate Sätteri plugins you can use) or block attributes (planned: bruits/satteri#139).


## How to use

`satteri-comark` provides two Sätteri plugins:

```ts
import directiveTwoColons from 'satteri-comark/2colons'
import comarkMdx from 'satteri-comark'
```

- `directiveTwoColons` parses two-colon directives `::component` into container directives.
- `comarkMdx` provides all other functionalities. It is possible to use this plugin without `directiveTwoColons`, it just means that two-colon directives will be parsed as leaf directives (Sätteri's deafult behavior).

To use:

```ts
import { mdxToJs } from 'satteri'

const result = mdxToJs(mdxSource, {
  features: {
    directive: true, // Turn on baseline support for directive syntax
  },
  mdastPlugins: [
    directiveTwoColons(), // must come before `comarkMdx`
    comarkMdx(),
  ]
})
```

This will parse Comark syntax with the default handling for named slots: the slot names are simply discarded. To configure this, and other behaviors of `satteri-comark`, pass options to `directiveTwoColons` and `comarkMdx`:

### Options for `directiveTwoColons`

You can pass an object with the following signature to configure this plugin:

```ts
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
```

### Options for `comarkMdx`

You can pass an object with the following signature to configure this plugin:

```ts
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
   * How to parse `[props]` code blocks in the given languages
   * @default viaConfbox
   */
  propsBlocks?: Record<string, (input: string) => unknown>

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
   * Define slot support in container directives
   * @default passthrough
   */
  slots?: (name: string, children: SlotContents) => BlockLevelContent | BlockLevelContent[]
}

export type BlockLevelContent = BlockContent | DefinitionContent

export type SlotContents =
  { type: 'inline'; contents: PhrasingContent[] } | { type: 'block'; contents: BlockLevelContent[] }
```

The default values `htmlOrPascalCase`, `viaConfbox`, and `passthrough` are as follows:

```ts
/**
 * Default value for `Options.normalizeCase`. If element name is a valid HTML tag, it will be
 * converted to lowercase. Otherwise, it will be converted to PascalCase.
 */
export function htmlOrPascalCase(name: string): string

/**
 * Default value for `Options.propsBlocks`. Uses the `confbox` library to parse the following
 * languages: JSON5, JSON with comments (JSONC), YAML, JSON, TOML, and INI.
 */
export const viaConfbox: Record<string, (input: string) => unknown>

/**
 * Default value for `Options.slots`. Passes through the slot contents as-is and discards the slot
 * name.
 */
export function passthrough(_name: string, children: SlotContents): BlockLevelContent[]
```

`satteri-comark` additionally exports a named slot adapter suitable for use with Astro. You should `import { astroFragment } from 'satteri-comark'` and pass it to the `slots` fields of the `Options` object.

```ts
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
export function astroFragment(name: string, children: SlotContents): BlockLevelContent
```
