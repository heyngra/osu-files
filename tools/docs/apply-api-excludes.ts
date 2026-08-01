import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { apiExcludes } from './api-excludes.js'

const generatedDir = join(process.cwd(), 'docs', 'api', 'generated')
const categoryDirs = ['classes', 'enumerations', 'functions', 'interfaces', 'type-aliases', 'variables']

const excludedPages = new Set<string>()
for (const symbol of apiExcludes) {
  for (const dir of categoryDirs) {
    const rel = `${dir}/${symbol}.md`
    if (existsSync(join(generatedDir, rel))) excludedPages.add(rel)
  }
}
if (!excludedPages.size) {
  console.log('No API pages excluded.')
  process.exit(0)
}

for (const rel of excludedPages) {
  rmSync(join(generatedDir, rel), { force: true })
  console.log(`Removed api/generated/${rel}`)
}

const linkPatterns = [...excludedPages].map(rel => ({
  base: rel.replace(/\.md$/, ''),
  regex: new RegExp(`\\[([^\\]]*)\\]\\(((?:\\.\\./)*)?${rel.replace(/\./g, '\\.').replace(/\//g, '\\/')}(?:#[^)]*)?\\)`, 'g'),
}))

const files: string[] = []
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name.endsWith('.md')) files.push(path)
  }
}
walk(generatedDir)

let rewritten = 0
for (const file of files) {
  let content = readFileSync(file, 'utf8')
  const before = content
  for (const { regex } of linkPatterns) content = content.replace(regex, (_match, label: string) => label)
  if (content !== before) {
    writeFileSync(file, content)
    rewritten++
  }
}
console.log(`Unlinked references across ${rewritten} pages.`)
