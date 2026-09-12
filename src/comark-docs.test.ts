import { expect, test } from 'vitest'
import { astroFragment } from '.'
import { parser } from './test-utils'

const parseAstro = parser({ slots: astroFragment })

test('Block', async () => {
  const source = `
::component-name{prop1="value1" prop2="value2"}
Content inside the component

Can have **markdown** and other elements
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Block > Alert', async () => {
  const source = `
::alert{type="info"}
This is an important message!
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Block > Card', async () => {
  const source = `
::card{title="My Card"}
Card content with **markdown** support
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Block > Empty', async () => {
  const source = `
::divider
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Inline', async () => {
  const source = `
Check out this :icon-star component in the middle of text.

Click the :button[Submit]{type="primary"} to continue.

The status is :badge[Active]{color="green"} right now.
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Properties > Inline attributes', async () => {
  const source = `
::component{prop="value"}
{/* Standard key-value pair */}
::

::component{bool}
{/* Boolean property (becomes :bool="true" in AST) */}
::

::component{#custom-id}
{/* ID attribute */}
::

::component{.class-name}
{/* CSS class */}
::

::component{.class-one .class-two}
{/* Multiple CSS classes */}
::

::component{:obj='\\{"key": "value"\\}'}
{/* Object/JSON value */}
::

::component{multiple="props" bool #id .class}
{/* Multiple properties combined */}
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Properties > Block props', async () => {
  const source = `
::component
\`\`\`yaml [props]
title: My Component
type: info
count: 42
enabled: true
items:
  - First item
  - Second item
config:
  theme: dark
  mode: auto
\`\`\`
Component content goes here

With full **markdown** support
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Properties > Combine both syntaxes', async () => {
  const source = `
::card{.featured}
\`\`\`yaml [props]
title: Featured Article
author: Jane Doe
tags:
  - markdown
  - documentation
\`\`\`
This combines inline class \`.featured\` with YAML props
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Properties > Use cases > Configuration-heavy components', async () => {
  const source = `
::data-table
\`\`\`yaml [props]
columns:
  - name: Name
    field: name
    sortable: true
  - name: Email
    field: email
    sortable: true
options:
  striped: true
  pageSize: 10
\`\`\`
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Properties > Use cases > API documentation', async () => {
  const source = `
::api-endpoint
\`\`\`yaml [props]
method: POST
path: /api/users
parameters:
  - name: username
    type: string
    required: true
  - name: email
    type: string
    required: true
response:
  status: 201
  body:
    id: string
    username: string
\`\`\`
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Data binding > Frontmatter', async () => {
  const source = `
---
theAnswer: 42
user:
  name: Ada
---

::question{:answer="frontmatter.theAnswer"}
::

Hello, :badge{:label="frontmatter.user.name"}
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Data binding > Runtime data', async () => {
  const source = `
Welcome, :badge{:label="data.user.name"}!
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Data binding > Parent component props', async () => {
  const source = `
::card{title="Hello" variant="primary"}
  :::badge{:color="props.variant" :text="props.title"}
  :::
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Slots > Default slot', async () => {
  const source = `
::alert{type="info"}
This content goes to the default slot.
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Slots > Default slot', async () => {
  const source = `
::card
#default
This is the **default** slot content.

#footer
Footer content here.
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Slots > Named slots', async () => {
  const source = `
::card
#header
## Card Title

#content
This is the main content of the card

#footer
Footer text here
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Slots > Combine with props', async () => {
  const source = `
::card{.featured}
\`\`\`yaml [props]
variant: elevated
color: primary
actions:
  - label: Read More
    url: /article
  - label: Share
    icon: share
\`\`\`
#header
## Article Title
*By Jane Doe*

#content
This is the main article content with **markdown** support.

#footer
Published on January 15, 2024
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Slots > Correct order', async () => {
  const source = `
::component{inline-attrs}
\`\`\`yaml [props]
yaml: props
\`\`\`
#slot-name
Slot content
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Slots > Incorrect order', async () => {
  const source = `
::component
#slot-name
Slot content
\`\`\`yaml [props]
yaml: props  <!-- This won't work -->
\`\`\`
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Nested', async () => {
  const source = `
::outer-component
Content in outer

:::inner-component{variant="compact"}
Content in inner
:::

More content in outer
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})

test('Nested > Deep nesting', async () => {
  const source = `
::level-1
  :::level-2
    ::::level-3
    Content
    ::::
  :::
::
`

  expect(await parseAstro(source)).toMatchSnapshot()
})
