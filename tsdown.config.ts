import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/2colons.ts'],
  dts: true,
})
