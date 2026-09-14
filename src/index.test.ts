import dedent from 'dedent'
import { expect, test } from 'vitest'
import { astroFragment } from '.'
import { parser } from './test-utils'

const parse = parser()
const parseAstro = parser({ slots: astroFragment })

// ---------------------------------------------------------------- code blocks

test('`[script]` blocks are hoisted into module scope', async () => {
  const source = dedent`
    \`\`\`jsx [script]
    import Foo from './foo.js'
    export const answer = 42
    \`\`\`

    Hello
  `

  expect(await parse(source, { full: true })).toMatchInlineSnapshot(`
    "/*@jsxRuntime automatic*/
    /*@jsxImportSource react*/
    "use strict";
    const { default: Foo } = arguments[0];
    const answer = 42;
    function _createMdxContent(props) {
      const _components = Object.assign({ p: "p" }, props.components);
      return <_components.p>{"Hello"}</_components.p>;
    }
    function MDXContent(props = {}) {
      const { wrapper: MDXLayout } = props.components || {};
      return MDXLayout ? (
        <MDXLayout {...props}>
          <_createMdxContent {...props} />
        </MDXLayout>
      ) : (
        _createMdxContent(props)
      );
    }
    return {
      answer,
      default: MDXContent,
    };
    "
  `)
})

test('`[script]` blocks work in tsx too', async () => {
  const source = dedent`
    \`\`\`tsx [script]
    import Foo from './foo.js'
    \`\`\`

    Hello
  `

  expect(await parse(source, { full: true })).toMatchInlineSnapshot(`
    "/*@jsxRuntime automatic*/
    /*@jsxImportSource react*/
    "use strict";
    const { default: Foo } = arguments[0];
    function _createMdxContent(props) {
      const _components = Object.assign({ p: "p" }, props.components);
      return <_components.p>{"Hello"}</_components.p>;
    }
    function MDXContent(props = {}) {
      const { wrapper: MDXLayout } = props.components || {};
      return MDXLayout ? (
        <MDXLayout {...props}>
          <_createMdxContent {...props} />
        </MDXLayout>
      ) : (
        _createMdxContent(props)
      );
    }
    return { default: MDXContent };
    "
  `)
})

test('`[embed]` blocks become JSX expressions', async () => {
  const source = dedent`
    \`\`\`jsx [embed]
    <div>{1 + 1}</div>
    \`\`\`
  `

  expect(await parse(source)).toMatchInlineSnapshot(`"<>{<div>{1 + 1}</div>}</>"`)
})

test('scriptBlocks: false leaves `[script]` blocks as code', async () => {
  const source = dedent`
    \`\`\`jsx [script]
    import Foo from './foo.js'
    \`\`\`
  `

  expect(await parser({ scriptBlocks: false })(source)).toMatchInlineSnapshot(`
    "(
      <pre>
        <code class="language-jsx">
          {"import Foo from './foo.js'\\n"}
        </code>
      </pre>
    )"
  `)
})

test('embedBlocks: false leaves `[embed]` blocks as code', async () => {
  const source = dedent`
    \`\`\`jsx [embed]
    <div>{1 + 1}</div>
    \`\`\`
  `

  expect(await parser({ embedBlocks: false })(source)).toMatchInlineSnapshot(`
    "(
      <pre>
        <code class="language-jsx">
          {"<div>{1 + 1}</div>\\n"}
        </code>
      </pre>
    )"
  `)
})

test('code blocks without a recognized meta are left alone', async () => {
  const source = dedent`
    \`\`\`jsx
    <div>{1 + 1}</div>
    \`\`\`
  `

  expect(await parse(source)).toMatchInlineSnapshot(`
    "(
      <pre>
        <code class="language-jsx">
          {"<div>{1 + 1}</div>\\n"}
        </code>
      </pre>
    )"
  `)
})

// --------------------------------------------------------------- spread props

test('`::` spreads an expression in an inline directive', async () => {
  expect(await parse(`:component{::="\\{prop: 'value'\\}"}`)).toMatchInlineSnapshot(`
    "(
      <p>
        <Component {...{ prop: "value" }} />
      </p>
    )"
  `)
})

test('`::` spreads an expression in a container directive', async () => {
  expect(await parse(`::component{::="\\{prop: 'value'\\}"}\n::`)).toMatchInlineSnapshot(
    `"<Component {...{ prop: "value" }} />"`,
  )
})

test('`...` spreads an expression from a props block', async () => {
  const source = dedent`
    ::component
    \`\`\`json [props]
    {"...": "{prop: 'value'}", "other": 1}
    \`\`\`
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(
    `"<Component {...{ prop: "value" }} other={1} />"`,
  )
})

test('`::` spreads an expression from a props block', async () => {
  const source = dedent`
    ::component
    \`\`\`json [props]
    {"::": "{prop: 'value'}"}
    \`\`\`
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(`"<Component {...{ prop: "value" }} />"`)
})

test('a binding whose value is not a string is serialized as JSON', async () => {
  const source = dedent`
    ::component
    \`\`\`json [props]
    {":count": 42, ":flag": true, ":nothing": null}
    \`\`\`
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(
    `"<Component count={42} flag={true} nothing={null} />"`,
  )
})

test('bindings: false passes `:`-prefixed names through verbatim', async () => {
  // Deliberately not valid JSX: with bindings off, `:a` is just a prop name. Needs `raw` because
  // Prettier cannot parse the result.
  expect(await parser({ bindings: false })(`::card{:a="b.c"}\n::`, { raw: true }))
    .toMatchInlineSnapshot(`
      "/*@jsxRuntime automatic*/
      /*@jsxImportSource react*/
      "use strict";
      function _createMdxContent(props) {
          const { Card } = props.components || {};
          if (!Card) _missingMdxReference("Card", true);
          return <Card :a="b.c" />;
      }
      function MDXContent(props = {}) {
          const { wrapper: MDXLayout } = props.components || {};
          return MDXLayout ? <MDXLayout {...props}><_createMdxContent {...props} /></MDXLayout> : _createMdxContent(props);
      }
      function _missingMdxReference(id, component) {
          throw new Error("Expected " + (component ? "component" : "object") + " \`" + id + "\` to be defined: you likely forgot to import, pass, or provide it.");
      }
      return { default: MDXContent };
      "
    `)
})

// --------------------------------------------------------------------- labels

test('a container directive label is passed through by default', async () => {
  const source = dedent`
    ::alert[Some **label**]
    Body text
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(`
    "(
      <Alert>
        <p>
          {"Some "}
          <strong>{"label"}</strong>
        </p>
        <p>{"Body text"}</p>
      </Alert>
    )"
  `)
})

test('labels default to the slots adapter', async () => {
  const source = dedent`
    ::alert[Some label]
    Body text
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Alert>
        <Fragment slot="label">{"Some label"}</Fragment>
        <p>{"Body text"}</p>
      </Alert>
    )"
  `)
})

test('labels can be configured separately from slots', async () => {
  const source = dedent`
    ::alert[Some label]
    #footer
    Footer text
    ::
  `

  expect(await parser({ slots: astroFragment, labels: () => [] })(source)).toMatchInlineSnapshot(`
      "(
        <Alert>
          <Fragment slot="footer">{"Footer text"}</Fragment>
        </Alert>
      )"
    `)
})

test('a label is emitted before slots and after props', async () => {
  const source = dedent`
    ::card[My Label]
    \`\`\`yaml [props]
    a: 1
    \`\`\`
    #header
    Head
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card a={1}>
        <Fragment slot="label">{"My Label"}</Fragment>
        <Fragment slot="header">{"Head"}</Fragment>
      </Card>
    )"
  `)
})

// ---------------------------------------------------------------------- slots

test('slots: null leaves slot markers as plain text', async () => {
  const source = dedent`
    ::card
    #header
    Head
    ::
  `

  expect(await parser({ slots: null })(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <p>{"#header\\nHead"}</p>
      </Card>
    )"
  `)
})

test('slots returning an empty array parse markers but drop their contents', async () => {
  const source = dedent`
    ::card
    #header
    Head

    #footer
    Foot
    ::
  `

  expect(await parser({ slots: () => [] })(source)).toMatchInlineSnapshot(`"<Card />"`)
})

test('slot names may contain spaces', async () => {
  const source = dedent`
    ::card
    #header with spaces
    Head
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <Fragment slot="header with spaces">{"Head"}</Fragment>
      </Card>
    )"
  `)
})

test('a slot with no content is dropped', async () => {
  const source = dedent`
    ::card
    #empty

    #footer
    Foot
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <Fragment slot="footer">{"Foot"}</Fragment>
      </Card>
    )"
  `)
})

test('adjacent slot markers each start a new slot', async () => {
  const source = dedent`
    ::card
    #a
    A
    #b
    B
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <Fragment slot="a">{"A"}</Fragment>
        <Fragment slot="b">{"B"}</Fragment>
      </Card>
    )"
  `)
})

test('content before the first slot marker is kept unslotted', async () => {
  const source = dedent`
    ::card
    Leading text
    #footer
    Foot
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <p>{"Leading text"}</p>
        <Fragment slot="footer">{"Foot"}</Fragment>
      </Card>
    )"
  `)
})

test('a slot mixing inline and block content is promoted to block', async () => {
  const source = dedent`
    ::card
    #header
    Some inline text

    ## And a heading

    More text
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <Fragment slot="header">
          <p>{"Some inline text"}</p>
          <h2>{"And a heading"}</h2>
          <p>{"More text"}</p>
        </Fragment>
      </Card>
    )"
  `)
})

test('inline content following block content in a slot is wrapped in its own paragraph', async () => {
  const source = dedent`
    ::card
    #a

    ## heading

    trailing inline
    #b
    B
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <Fragment slot="a">
          <h2>{"heading"}</h2>
          <p>{"trailing inline"}</p>
        </Fragment>
        <Fragment slot="b">{"B"}</Fragment>
      </Card>
    )"
  `)
})

// ---------------------------------------------------------------- props blocks

const propsBlock = (lang: string, body: string) =>
  `::card\n\`\`\`${lang} [props]\n${body}\n\`\`\`\n::`

test('props blocks parse json5', async () => {
  expect(await parse(propsBlock('json5', '{a: 1, b: "two"}'))).toMatchInlineSnapshot(
    `"<Card a={1} b="two" />"`,
  )
})

test('props blocks parse jsonc', async () => {
  expect(
    await parse(propsBlock('jsonc', '{/* comment */ "a": 1, "b": "two"}')),
  ).toMatchInlineSnapshot(`"<Card a={1} b="two" />"`)
})

test('props blocks parse yaml', async () => {
  expect(await parse(propsBlock('yaml', 'a: 1\nb: two'))).toMatchInlineSnapshot(
    `"<Card a={1} b="two" />"`,
  )
})

test('props blocks parse json', async () => {
  expect(await parse(propsBlock('json', '{"a": 1, "b": "two"}'))).toMatchInlineSnapshot(
    `"<Card a={1} b="two" />"`,
  )
})

test('props blocks parse toml', async () => {
  expect(await parse(propsBlock('toml', 'a = 1\nb = "two"'))).toMatchInlineSnapshot(
    `"<Card a={1} b="two" />"`,
  )
})

test('props blocks parse ini, which yields strings rather than numbers', async () => {
  expect(await parse(propsBlock('ini', 'a=1\nb=two'))).toMatchInlineSnapshot(
    `"<Card a="1" b="two" />"`,
  )
})

test('propsBlocks: null leaves props blocks as code', async () => {
  const source = dedent`
    ::card
    \`\`\`yaml [props]
    a: 1
    \`\`\`
    ::
  `

  expect(await parser({ propsBlocks: null })(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <pre>
          <code class="language-yaml">{"a: 1\\n"}</code>
        </pre>
      </Card>
    )"
  `)
})

test('propsBlocks can be replaced with a custom parser table', async () => {
  const source = dedent`
    ::card
    \`\`\`csv [props]
    a,1
    b,2
    \`\`\`
    ::
  `
  const csv = (input: string) =>
    Object.fromEntries(
      input
        .trim()
        .split('\n')
        .map(line => line.split(',')),
    )

  expect(await parser({ propsBlocks: { csv } })(source)).toMatchInlineSnapshot(
    `"<Card a="1" b="2" />"`,
  )
})

test('a props block in an unconfigured language is left as code', async () => {
  const source = dedent`
    ::card
    \`\`\`xml [props]
    <a/>
    \`\`\`
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <pre>
          <code class="language-xml">{"<a/>\\n"}</code>
        </pre>
      </Card>
    )"
  `)
})

test('a props block parsing to a scalar is ignored', async () => {
  const source = dedent`
    ::card
    \`\`\`yaml [props]
    42
    \`\`\`
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(`"<Card />"`)
})

test('a props block parsing to an array is ignored', async () => {
  const source = dedent`
    ::card
    \`\`\`yaml [props]
    - a
    - b
    \`\`\`
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(`"<Card />"`)
})

test('a props block that is not the first child is left as code', async () => {
  const source = dedent`
    ::card
    Text first

    \`\`\`yaml [props]
    a: 1
    \`\`\`
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <p>{"Text first"}</p>
        <pre>
          <code class="language-yaml">{"a: 1\\n"}</code>
        </pre>
      </Card>
    )"
  `)
})

test('props blocks override inline attributes of the same name', async () => {
  const source = dedent`
    ::card{a="inline" b="inline"}
    \`\`\`yaml [props]
    a: block
    \`\`\`
    ::
  `

  expect(await parse(source)).toMatchInlineSnapshot(`"<Card a="block" b="inline" />"`)
})

// ------------------------------------------------------------- normalizeCase

test('normalizeCase lowercases known HTML tags', async () => {
  expect(await parse(`::DIV\n::`)).toMatchInlineSnapshot(`"<div />"`)
})

test('normalizeCase PascalCases everything else', async () => {
  expect(await parse(`::foo-bar\n::`)).toMatchInlineSnapshot(`"<FooBar />"`)
})

test('normalizeCase can be replaced', async () => {
  expect(
    await parser({ normalizeCase: name => `X${name}` })(`::foo-bar\n::`),
  ).toMatchInlineSnapshot(`"<Xfoo-bar />"`)
})

test('normalizeCase can be disabled with an identity function', async () => {
  expect(await parser({ normalizeCase: name => name })(`::DIV\n::`)).toMatchInlineSnapshot(
    `"<DIV />"`,
  )
})

// --------------------------------------------------------- leaf/text directives

test('leaf directives become flow elements', async () => {
  expect(await parse(`:::leaf{a="b"}`)).toMatchInlineSnapshot(`"<Leaf a="b" />"`)
})

test('text directives become text elements', async () => {
  expect(await parse(`Some :badge[Label]{a="b"} text`)).toMatchInlineSnapshot(`
    "(
      <p>
        {"Some "}
        <Badge a="b">{"Label"}</Badge>
        {" text"}
      </p>
    )"
  `)
})
