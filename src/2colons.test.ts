import { expect, test } from 'vitest'
import { parser } from './test-utils'

const parseSelfClosing = parser()
const parseGreedy = parser({ onUnterminated: 'greedy' })
const parseStrict = parser({ onUnterminated: 'error' })

test('parses empty 2-colon directive', async () => {
  const source = `
::directive
::
`

  expect(await parseSelfClosing(source)).toMatchSnapshot()
})

test('parses nonempty 2-colon directive', async () => {
  const source = `
::directive

## Title

Lorem ipsum sit amet, ...

![](image.jpg)

:::nested-directive
something else
:::

::
`

  expect(await parseSelfClosing(source)).toMatchSnapshot()
})

test('parses directives in nested contexts', async () => {
  const source = `
> ::directive
> directive inside blockquote
> ::

:::directive
::directive-2
directive inside another directive
::
:::
`

  expect(await parseSelfClosing(source)).toMatchSnapshot()
})

test('parses unterminated directives as self-closing by default', async () => {
  const source = `
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

  expect(await parseSelfClosing(source)).toMatchSnapshot()
})

test('onUnterminated: "greedy" parses unterminated directives greedily', async () => {
  const source = `
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

  expect(await parseGreedy(source)).toMatchSnapshot()
})

test('onUnterminated: "error" throws an error on unterminated directives', async () => {
  const source = `
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

  await expect(parseStrict(source)).rejects.toThrowErrorMatchingSnapshot()
})

test('any container nesting with distinct numbers of colons on each level parses correctly', async () => {
  const source = `
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

  expect(await parseStrict(source)).toMatchSnapshot()
})
