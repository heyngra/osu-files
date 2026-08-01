import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PLAYWRIGHT_PORT must be a valid TCP port')

export default defineConfig({
  testDir: './tests/docs',
  testMatch: '**/*.spec.ts',
  webServer: { command: `vitepress dev docs --host 127.0.0.1 --port ${port}`, port, reuseExistingServer: false, timeout: 30_000 },
  use: { baseURL: `http://127.0.0.1:${port}` },
})
