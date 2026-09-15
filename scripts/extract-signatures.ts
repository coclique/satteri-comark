import * as Path from 'node:path'
import { $, file, write } from 'bun'
import type { Code } from 'mdast'
import { toMarkdown } from 'mdast-util-to-markdown'
import { isolatedDeclarationSync } from 'oxc-transform'
import { format } from 'prettier'
import { markdownToMdast } from 'satteri'
import { Node, Project } from 'ts-morph'
import { selectAll } from 'unist-util-select'
import { visit } from 'unist-util-visit'

const prettierrc = JSON.parse(await file('.prettierrc').text())

const requests = new Set<string>()
const targetPattern = /\[extract +(\S+?) (.*?)\]/g

const tree = markdownToMdast(await file('README.md').text())

for (const node of selectAll('code', tree) as Code[]) {
  if (node.lang !== 'ts') continue
  const matches = node.meta?.matchAll(targetPattern)
  for (const [_, path] of matches ?? []) requests.add(path)
}

const project = new Project({ useInMemoryFileSystem: true })
const mappings = new Map<string, Record<string, string>>()

await Promise.all(
  Array.from(requests).map(async path => {
    const dtsPath = path.split('.').slice(0, -1).join('.') + '.d.ts'
    let program = project.getSourceFile(dtsPath)

    if (!program) {
      const source = await file(path).text()
      let { code: dts, errors } = isolatedDeclarationSync(Path.basename(path), source)
      if (errors.length)
        throw new Error(`Errors in ${path}:\n${errors.map(e => e.message).join('\n')}`)
      dts = await format(dts.replaceAll('/**', '\n/**').replaceAll('export declare ', 'export '), {
        parser: 'typescript',
        ...prettierrc,
      })
      program = project.createSourceFile(dtsPath, dts)
    }

    const mapping = Object.fromEntries(
      program
        .getStatements()
        .map(stmt => {
          const text = stmt.getText({ includeJsDocComments: true })
          if (Node.isVariableStatement(stmt)) {
            for (const decl of stmt.getDeclarations())
              if (Node.isIdentifier(decl.getNameNode()))
                return [[decl.getNameNode().getText(), text]]
          }
          if (Node.hasName(stmt)) return [[stmt.getName(), text]]
          return []
        })
        .flat(),
    )
    mappings.set(path, mapping)
  }),
)

visit(tree, 'code', node => {
  if (node.lang !== 'ts') return
  const matches = node.meta?.matchAll(targetPattern)
  if (!matches) return
  node.value = Array.from(matches)
    .map(([_, path, names]) =>
      names
        .split(' ')
        .filter(name => name)
        .map(name => mappings.get(path)![name]),
    )
    .flat()
    .join('\n\n')
})

const rewritten = toMarkdown(tree, {
  bullet: '-',
  rule: '-',
})

await write('README.md', rewritten)
await $`git add README.md`
