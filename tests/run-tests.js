import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative } from 'node:path'

function testFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...testFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) files.push(path)
  }

  return files.sort()
}

const root = process.cwd()
const setup = './tests/setup.js'
let exitCode = 0

for (const file of testFiles(join(root, 'tests'))) {
  const relativeFile = relative(root, file)
  const result = spawnSync(process.execPath, [
    '--import', 'tsx',
    '--import', setup,
    '--test',
    '--test-force-exit',
    '--test-reporter', 'dot',
    relativeFile,
  ], { stdio: 'inherit' })

  if (result.error) throw result.error
  if (result.status !== 0) exitCode = result.status ?? 1
}

process.exitCode = exitCode
