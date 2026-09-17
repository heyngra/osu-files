import { defineConfig } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PLAYWRIGHT_PORT must be a valid TCP port')

export default defineConfig({
  testDir: './tests/docs',
  testMatch: '**/*.spec.ts',
  webServer: { command: `npm run docs:dev -- ${process.env.CI ? '--rebuild ' : ''}--host 127.0.0.1 --port ${port}`, port, reuseExistingServer: false, timeout: 600_000 },
  use: { baseURL: `http://127.0.0.1:${port}` },
})
