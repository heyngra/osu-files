import { readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const prefixes = [
  'osu-files-test-',
  'osu-files-migration-',
  'osu-files-malformed-mods-',
  'osu-files-readonly-',
  'osu-files-query-',
  'osu-files-raw-query-',
  'osu-files-readonly-store-',
  'osu-files-score-version-',
  'osu-files-keybinding-migration-',
  'osu-files-mania-migration-',
  'osu-files-schema-six-',
  'osu-files-collections-migration-',
  'osk-',
  'osz-test-',
]

for (const entry of readdirSync(tmpdir())) {
  if (!prefixes.some(prefix => entry.startsWith(prefix))) continue
  try { rmSync(join(tmpdir(), entry), { recursive: true, force: true }) } catch {}
}
