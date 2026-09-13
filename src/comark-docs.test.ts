import dedent from 'dedent'
import { expect, test } from 'vitest'
import { astroFragment } from '.'
import { parser } from './test-utils'

const parseAstro = parser({ slots: astroFragment })

test('Block', async () => {
  const source = dedent`
    ::component-name{prop1="value1" prop2="value2"}
    Content inside the component

    Can have **markdown** and other elements
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <ComponentName prop1="value1" prop2="value2">
        <p>{"Content inside the component"}</p>
        <p>
          {"Can have "}
          <strong>{"markdown"}</strong>
          {" and other elements"}
        </p>
      </ComponentName>
    )"
  `)
})

test('Block > Alert', async () => {
  const source = dedent`
    ::alert{type="info"}
    This is an important message!
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Alert type="info">
        <p>{"This is an important message!"}</p>
      </Alert>
    )"
  `)
})

test('Block > Card', async () => {
  const source = dedent`
    ::card{title="My Card"}
    Card content with **markdown** support
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card title="My Card">
        <p>
          {"Card content with "}
          <strong>{"markdown"}</strong>
          {" support"}
        </p>
      </Card>
    )"
  `)
})

test('Block > Empty', async () => {
  const source = dedent`
    ::divider
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`"<Divider />"`)
})

test('Inline', async () => {
  const source = dedent`
    Check out this :icon-star component in the middle of text.

    Click the :button[Submit]{type="primary"} to continue.

    The status is :badge[Active]{color="green"} right now.
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <>
        <p>
          {"Check out this "}
          <IconStar />
          {" component in the middle of text."}
        </p>
        {"\\n"}
        <p>
          {"Click the "}
          <button type="primary">{"Submit"}</button>
          {" to continue."}
        </p>
        {"\\n"}
        <p>
          {"The status is "}
          <Badge color="green">{"Active"}</Badge>
          {" right now."}
        </p>
      </>
    )"
  `)
})

test('Properties > Inline attributes', async () => {
  const source = dedent`
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

    ::component{:obj='\{"key": "value"\}'}
    {/* Object/JSON value */}
    ::

    ::component{multiple="props" bool #id .class}
    {/* Multiple properties combined */}
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <>
        <Component prop="value">{}</Component>
        {"\\n"}
        <Component bool="">{}</Component>
        {"\\n"}
        <Component id="custom-id">{}</Component>
        {"\\n"}
        <Component class="class-name">{}</Component>
        {"\\n"}
        <Component class="class-one class-two">{}</Component>
        {"\\n"}
        <Component obj={{ key: "value" }}>{}</Component>
        {"\\n"}
        <Component multiple="props" bool="" id="id" class="class">
          {}
        </Component>
      </>
    )"
  `)
})

test('Properties > Block props', async () => {
  const source = dedent`
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

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Component
        title="My Component"
        type="info"
        count={42}
        enabled={true}
        items={["First item", "Second item"]}
        config={{
          theme: "dark",
          mode: "auto",
        }}
      >
        <p>{"Component content goes here"}</p>
        <p>
          {"With full "}
          <strong>{"markdown"}</strong>
          {" support"}
        </p>
      </Component>
    )"
  `)
})

test('Properties > Combine both syntaxes', async () => {
  const source = dedent`
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

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card
        class="featured"
        title="Featured Article"
        author="Jane Doe"
        tags={["markdown", "documentation"]}
      >
        <p>
          {"This combines inline class "}
          <code>{".featured"}</code>
          {" with YAML props"}
        </p>
      </Card>
    )"
  `)
})

test('Properties > Use cases > Configuration-heavy components', async () => {
  const source = dedent`
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

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <DataTable
        columns={[
          {
            name: "Name",
            field: "name",
            sortable: true,
          },
          {
            name: "Email",
            field: "email",
            sortable: true,
          },
        ]}
        options={{
          striped: true,
          pageSize: 10,
        }}
      />
    )"
  `)
})

test('Properties > Use cases > API documentation', async () => {
  const source = dedent`
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

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <ApiEndpoint
        method="POST"
        path="/api/users"
        parameters={[
          {
            name: "username",
            type: "string",
            required: true,
          },
          {
            name: "email",
            type: "string",
            required: true,
          },
        ]}
        response={{
          status: 201,
          body: {
            id: "string",
            username: "string",
          },
        }}
      />
    )"
  `)
})

test('Data binding > Frontmatter', async () => {
  const source = dedent`
    ---
    theAnswer: 42
    user:
      name: Ada
    ---

    ::question{:answer="frontmatter.theAnswer"}
    ::

    Hello, :badge{:label="frontmatter.user.name"}
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <>
        <Question answer={frontmatter.theAnswer} />
        {"\\n"}
        <p>
          {"Hello, "}
          <Badge label={frontmatter.user.name} />
        </p>
      </>
    )"
  `)
})

test('Data binding > Runtime data', async () => {
  const source = dedent`
    Welcome, :badge{:label="data.user.name"}!
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <p>
        {"Welcome, "}
        <Badge label={data.user.name} />
        {"!"}
      </p>
    )"
  `)
})

test('Data binding > Parent component props', async () => {
  const source = dedent`
    ::card{title="Hello" variant="primary"}
      :::badge{:color="props.variant" :text="props.title"}
      :::
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card title="Hello" variant="primary">
        <Badge color={props.variant} text={props.title} />
      </Card>
    )"
  `)
})

test('Slots > Default slot', async () => {
  const source = dedent`
    ::alert{type="info"}
    This content goes to the default slot.
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Alert type="info">
        <p>{"This content goes to the default slot."}</p>
      </Alert>
    )"
  `)
})

test('Slots > Default slot', async () => {
  const source = dedent`
    ::card
    #default
    This is the **default** slot content.

    #footer
    Footer content here.
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <Fragment slot="default">
          {"This is the "}
          <strong>{"default"}</strong>
          {" slot content."}
        </Fragment>
        <Fragment slot="footer">{"Footer content here."}</Fragment>
      </Card>
    )"
  `)
})

test('Slots > Named slots', async () => {
  const source = dedent`
    ::card
    #header
    ## Card Title

    #content
    This is the main content of the card

    #footer
    Footer text here
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Card>
        <Fragment slot="header">
          <h2>{"Card Title"}</h2>
        </Fragment>
        <Fragment slot="content">
          {"This is the main content of the card"}
        </Fragment>
        <Fragment slot="footer">{"Footer text here"}</Fragment>
      </Card>
    )"
  `)
})

test('Slots > Combine with props', async () => {
  const source = dedent`
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

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
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
    )"
  `)
})

test('Slots > Correct order', async () => {
  const source = dedent`
    ::component{inline-attrs}
    \`\`\`yaml [props]
    yaml: props
    \`\`\`
    #slot-name
    Slot content
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Component inline-attrs="" yaml="props">
        <Fragment slot="slot-name">{"Slot content"}</Fragment>
      </Component>
    )"
  `)
})

test('Slots > Incorrect order', async () => {
  const source = dedent`
    ::component
    #slot-name
    Slot content
    \`\`\`yaml [props]
    yaml: props  <!-- This won't work -->
    \`\`\`
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Component>
        <Fragment slot="slot-name">
          <p>{"Slot content"}</p>
          <pre>
            <code class="language-yaml">
              {"yaml: props  <!-- This won't work -->\\n"}
            </code>
          </pre>
        </Fragment>
      </Component>
    )"
  `)
})

test('Nested', async () => {
  const source = dedent`
    ::outer-component
    Content in outer

    :::inner-component{variant="compact"}
    Content in inner
    :::

    More content in outer
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <OuterComponent>
        <p>{"Content in outer"}</p>
        <InnerComponent variant="compact">
          <p>{"Content in inner"}</p>
        </InnerComponent>
        <p>{"More content in outer"}</p>
      </OuterComponent>
    )"
  `)
})

test('Nested > Deep nesting', async () => {
  const source = dedent`
    ::level-1
      :::level-2
        ::::level-3
        Content
        ::::
      :::
    ::
  `

  expect(await parseAstro(source)).toMatchInlineSnapshot(`
    "(
      <Level1>
        <Level2>
          <Level3>
            <p>{"Content"}</p>
          </Level3>
        </Level2>
      </Level1>
    )"
  `)
})
