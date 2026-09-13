import { $, Glob, file, write } from 'bun'

const rewrites = [
  (async () => {
    const content = await file('README.md').text()
    const replaced = content.replaceAll('Satteri', 'Sätteri')
    await write('README.md', replaced)
  })(),
]

const srcFiles = await Array.fromAsync(new Glob('src/**/*.ts').scan('.'))
rewrites.push(
  ...srcFiles.map(async filename => {
    const content = await file(filename).text()
    const replaced = content.replaceAll(/\/\*\*.*?\*\//gs, match =>
      match.replaceAll('Satteri', 'Sätteri'),
    )
    await write(filename, replaced)
  }),
)

await Promise.all(rewrites)
await $`git add README.md src/**/*.ts`
