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
for (const rel of excludedPages) {
  rmSync(join(generatedDir, rel), { force: true })
  console.log(`Removed api/generated/${rel}`)
}
if (!excludedPages.size) console.log('No API pages excluded.')

const linkPatterns = [...excludedPages].map(rel => ({
  base: rel.replace(/\.md$/, ''),
  regex: new RegExp(`\\[([^\\]]*)\\]\\(((?:\\.\\./)*)?${rel.replace(/\./g, '\\.').replace(/\//g, '\\/')}(?:#[^)]*)?\\)`, 'g'),
}))
const basenameLinkPatterns = [...excludedPages].map(rel => {
  const filename = rel.slice(rel.lastIndexOf('/') + 1).replace('.', '\\.')
  return new RegExp('\\[([^\\]]*)\\]\\((?:[^)]*\\/)?' + filename + '(?:#[^)]*)?\\)', 'g')
})

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
function removeInternalMemberSections(markdown: string): string {
  const lines = markdown.replace(/<a id="_[^"]+"><\/a>\n?/g, '').replace(/\r\n/g, '\n').split('\n')
  const result: string[] = []
  let skipping = false
  for (const line of lines) {
    if (!skipping && /^### \\?_/.test(line.trim())) {
      skipping = true
      continue
    }
    if (skipping && (line.trim() === '***' || /^## /.test(line.trim()))) {
      skipping = false
      if (line.trim() !== '***') result.push(line)
      continue
    }
    if (!skipping) result.push(line)
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n')
}

for (const file of files) {
  let content = readFileSync(file, 'utf8')
  const before = content
  for (const { regex } of linkPatterns) content = content.replace(regex, (_match, label: string) => label)
  for (const regex of basenameLinkPatterns) content = content.replace(regex, (_match, label: string) => label)
  if (file === join(generatedDir, 'globals.md')) {
    // Keep hidden symbols out of the raw TypeDoc index.
    content = content
      .split(/\r?\n/)
      .filter(line => {
        const match = line.match(/^- (?:\[([^\]]+)\]\([^)]*\)|(\S+))$/)
        const name = match?.[1] ?? match?.[2]
        return !name || !apiExcludes.includes(name)
      })
      .join('\n')
  }
  content = removeInternalMemberSections(content)
  if (content !== before) {
    writeFileSync(file, content)
    rewritten++
  }
}
console.log(`Unlinked references across ${rewritten} pages.`)
