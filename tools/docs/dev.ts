import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const args = process.argv.slice(2)
const rebuild = args.includes('--rebuild')
const forward = args.filter(arg => arg !== '--rebuild')

function sh(cmd: string, cmdArgs: string[]): number {
  return spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: true }).status ?? 1
}

function serve(): never {
  process.exit(sh('npx', ['vitepress', 'dev', 'docs', ...forward]))
}

if (rebuild || !existsSync('docs/.generated/api-manifest.json')) {
  if (sh('npm', ['run', 'docs:generate']) !== 0) process.exit(1)
  serve()
}

if (sh('npm', ['run', 'docs:guides']) !== 0) {
  if (sh('npm', ['run', 'docs:generate']) !== 0) process.exit(1)
}
serve()
