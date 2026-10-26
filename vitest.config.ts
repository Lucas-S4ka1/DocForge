import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Tests laufen in der Electron-Runtime (ELECTRON_RUN_AS_NODE), damit native Module
// wie better-sqlite3 mit derselben ABI geladen werden wie in der App.
export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
  test: { include: ['tests/**/*.test.ts'], pool: 'forks', environment: 'node' }
})
