import dedent from 'dedent'
import { expect, test } from 'vitest'
import { parser } from './test-utils'

const parseSelfClosing = parser()
const parseGreedy = parser({ onUnterminated: 'greedy' })
const parseStrict = parser({ onUnterminated: 'error' })

test('parses empty 2-colon directive', async () => {
  const source = dedent`
    ::directive
    ::
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`"<Directive />"`)
})

test('parses nonempty 2-colon directive', async () => {
  const source = dedent`
    ::directive

    ## Title

    Lorem ipsum sit amet, ...

    ![](image.jpg)

    :::nested-directive
    something else
    :::

    ::
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`
    "(
      <Directive>
        <h2>{"Title"}</h2>
        <p>{"Lorem ipsum sit amet, ..."}</p>
        <p>
          <img src="image.jpg" alt="" />
        </p>
        <NestedDirective>
          <p>{"something else"}</p>
        </NestedDirective>
      </Directive>
    )"
  `)
})

test('parses directives in nested contexts', async () => {
  const source = dedent`
    > ::directive
    > directive inside blockquote
    > ::

    :::directive
    ::directive-2
    directive inside another directive
    ::
    :::
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`
    "(
      <>
        <blockquote>
          {"\\n"}
          <Directive>
            <p>{"directive inside blockquote"}</p>
          </Directive>
          {"\\n"}
        </blockquote>
        {"\\n"}
        <Directive>
          <Directive2>
            <p>{"directive inside another directive"}</p>
          </Directive2>
        </Directive>
      </>
    )"
  `)
})

test('parses unterminated directives as self-closing by default', async () => {
  const source = dedent`
    ::directive

    Should be at top-level

    :::directive-2
    :::

    ::directive
    ::

    > ::directive
    > Should be directly inside blockquote

    Some more text
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`
    "(
      <>
        <Directive />
        {"\\n"}
        <p>{"Should be at top-level"}</p>
        {"\\n"}
        <Directive2 />
        {"\\n"}
        <Directive />
        {"\\n"}
        <blockquote>
          {"\\n"}
          <Directive />
          {"\\n"}
          <p>{"Should be directly inside blockquote"}</p>
          {"\\n"}
        </blockquote>
        {"\\n"}
        <p>{"Some more text"}</p>
      </>
    )"
  `)
})

test('onUnterminated: "greedy" parses unterminated directives greedily', async () => {
  const source = dedent`
    ::directive

    Should extend until the next 2-colon directive

    :::directive-2
    :::

    ::directive
    ::

    > ::directive
    > Should extend to the end of blockquote

    Some more text
  `

  expect(await parseGreedy(source)).toMatchInlineSnapshot(`
    "(
      <>
        <Directive>
          <p>
            {"Should extend until the next 2-colon directive"}
          </p>
          <Directive2 />
        </Directive>
        {"\\n"}
        <Directive />
        {"\\n"}
        <blockquote>
          {"\\n"}
          <Directive>
            <p>
              {"Should extend to the end of blockquote"}
            </p>
          </Directive>
          {"\\n"}
        </blockquote>
        {"\\n"}
        <p>{"Some more text"}</p>
      </>
    )"
  `)
})

test('onUnterminated: "error" throws an error on unterminated directives', async () => {
  const source = dedent`
    ::directive

    Should extend until the next 2-colon directive

    :::directive-2
    :::

    ::directive
    ::

    > ::directive
    > Should extend to the end of blockquote

    Some more text
  `

  await expect(parseStrict(source)).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Unterminated directive: directive]`,
  )
})

test('any container nesting with distinct numbers of colons on each level parses correctly', async () => {
  const source = dedent`
    ::directive
    one
    :::::directive-2
    two
    :::directive-3
    three
    ::::directive-4
    four
    ::::
    five
    :::
    six
    :::::
    seven
    ::
  `

  expect(await parseStrict(source)).toMatchInlineSnapshot(`
    "(
      <Directive>
        <p>{"one"}</p>
        <Directive2>
          <p>{"two"}</p>
          <Directive3>
            <p>{"three"}</p>
            <Directive4>
              <p>{"four"}</p>
            </Directive4>
            <p>{"five"}</p>
          </Directive3>
          <p>{"six"}</p>
        </Directive2>
        <p>{"seven"}</p>
      </Directive>
    )"
  `)
})

test('parses directives inside list items', async () => {
  const source = dedent`
    - ::directive
      inside a list item
      ::
    - plain item
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`
    "(
      <ul>
        {"\\n"}
        <li>
          {"\\n"}
          <Directive>
            <p>{"inside a list item"}</p>
          </Directive>
          {"\\n"}
        </li>
        {"\\n"}
        <li>{"plain item"}</li>
        {"\\n"}
      </ul>
    )"
  `)
})

test('parses directives inside footnote definitions', async () => {
  const source = dedent`
    Text[^1]

    [^1]: ::directive
        inside a footnote
        ::
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`
    "(
      <>
        <p>
          {"Text"}
          <sup>
            <a
              href="#user-content-fn-1"
              id="user-content-fnref-1"
              data-footnote-ref
              aria-describedby="footnote-label"
            >
              {"1"}
            </a>
          </sup>
        </p>
        {"\\n"}
        <section data-footnotes class="footnotes">
          <h2 class="sr-only" id="footnote-label">
            {"Footnotes"}
          </h2>
          {"\\n"}
          <ol>
            {"\\n"}
            <li id="user-content-fn-1">
              {"\\n"}
              <Directive>
                <p>{"inside a footnote"}</p>
              </Directive>
              {"\\n"}
              <a
                href="#user-content-fnref-1"
                data-footnote-backref=""
                aria-label="Back to reference 1"
                class="data-footnote-backref"
              >
                {"↩"}
              </a>
              {"\\n"}
            </li>
            {"\\n"}
          </ol>
          {"\\n"}
        </section>
      </>
    )"
  `)
})

test('parses directives inside description details', async () => {
  const source = dedent`
    Term

    : ::directive
      inside a description
      ::
  `

  expect(await parseSelfClosing(source, { features: { directive: true, definitionList: true } }))
    .toMatchInlineSnapshot(`
    "(
      <dl>
        {"\\n"}
        <dt>{"Term"}</dt>
        {"\\n"}
        <dd>
          {"\\n"}
          <Directive>
            <p>{"inside a description"}</p>
          </Directive>
          {"\\n"}
        </dd>
        {"\\n"}
      </dl>
    )"
  `)
})

test('parses directives inside JSX flow elements', async () => {
  const source = dedent`
    <div>

    ::directive
    inside a JSX element
    ::

    </div>
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`
    "(
      <div>
        <Directive>
          <p>{"inside a JSX element"}</p>
        </Directive>
      </div>
    )"
  `)
})

test('a 2-colon directive label becomes a directive label paragraph', async () => {
  const source = dedent`
    ::directive[The **label**]
    Body text
    ::
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`
    "(
      <Directive>
        <p>
          {"The "}
          <strong>{"label"}</strong>
        </p>
        <p>{"Body text"}</p>
      </Directive>
    )"
  `)
})

test('content trailing the closing `::` stays outside the directive', async () => {
  const source = dedent`
    ::directive
    inside
    ::
    outside
  `

  expect(await parseSelfClosing(source)).toMatchInlineSnapshot(`
    "(
      <>
        <Directive>
          <p>{"inside"}</p>
        </Directive>
        {"\\n"}
        <p>{"outside"}</p>
      </>
    )"
  `)
})
