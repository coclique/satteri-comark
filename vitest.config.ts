import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-utils.ts'],
      reporter: ['text', 'html'],
      // Branches isn't 100 because of the `attrs ?? {}` fallback in `makeAttrs`, which never
      // triggers since Satteri passes `{}` even for directives without attributes.
      thresholds: {
        statements: 100,
        functions: 100,
        lines: 100,
        branches: 99,
      },
    },
  },
})
