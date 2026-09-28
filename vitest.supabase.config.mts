import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/** Integration tests against a running Supabase stack (see tests/supabase). */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { include: ['tests/supabase/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false },
})
