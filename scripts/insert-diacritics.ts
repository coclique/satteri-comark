/// <reference types="bun" />

import * as Fs from 'node:fs/promises'
import { $, Glob } from 'bun'

const rewrites = [
  (async () => {
    const content = await Fs.readFile('README.md', 'utf8')
    const replaced = content.replaceAll('Satteri', 'Sätteri')
    await Fs.writeFile('README.md', replaced)
  })(),
]

const srcFiles = await Array.fromAsync(new Glob('src/**/*.ts').scan('.'))
rewrites.push(
  ...srcFiles.map(async file => {
    const content = await Fs.readFile(file, 'utf8')
    const replaced = content.replaceAll(/\/\*\*.*?\*\//gs, match =>
      match.replaceAll('Satteri', 'Sätteri'),
    )
    await Fs.writeFile(file, replaced)
  }),
)

await Promise.all(rewrites)
await $`git add README.md src/**/*.ts`
