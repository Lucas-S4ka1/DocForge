import { defineConfig } from '@playwright/test'

// E2E-Tests starten die gebaute App (npm run build) in Electron.
// Ohne Bildschirm (Linux/CI): xvfb-run npm run test:e2e
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' }
})
