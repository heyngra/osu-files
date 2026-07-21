import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { init, type InitOptions } from '../src/index.js'

const TEST_PREFIX = 'osu-files-test-'

export function nukeOldTestDirs() {
  const tmp = tmpdir()
  for (const entry of readdirSync(tmp)) {
    if (!entry.startsWith(TEST_PREFIX) && !entry.startsWith('osk-') && !entry.startsWith('osz-test-')) continue
    try { rmSync(join(tmp, entry), { recursive: true, force: true }) } catch { /* in use, skip */ }
  }
}

export function testInit(sourcePath: string, options?: InitOptions) {
  nukeOldTestDirs()
  const dir = mkdtempSync(join(tmpdir(), TEST_PREFIX))
  const copyPath = join(dir, 'client.realm')
  copyFileSync(sourcePath, copyPath)

  const app = init(copyPath, options)
  const origClose = app.close

  app.close = () => {
    origClose()
    rmSync(dir, { recursive: true, force: true })
  }

  return app
}

export const SAMPLE_OSZ = './tests/506483 Icon For Hire - Make A Move.osz'
export const SAMPLE_OSK = './tests/whitecatskin.osk'
