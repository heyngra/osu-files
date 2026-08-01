import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const required = ['docs/index.md', 'docs/public/CNAME', 'docs/api/index.md', 'docs/api/catalog.md', 'docs/api/_generated-sidebar.json', 'docs/.generated/api-manifest.json', 'docs/.vitepress/pure-api.ts']
for (const file of required) if (!existsSync(resolve(root, file))) throw new Error(`Missing documentation file: ${file}`)
if (readFileSync(resolve(root, 'docs/public/CNAME'), 'utf8').trim() !== 'osu-files.heyn.live') throw new Error('Invalid CNAME')
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-manifest.json'), 'utf8')) as Array<{ importPath: string; documentationPage: string }>
if (manifest.some(item => item.importPath !== 'osu-files')) throw new Error('API manifest contains a non-Node import path')
if (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).exports['./browser']) throw new Error('Public browser export must not exist')
for (const item of manifest) {
  const page = item.documentationPage.split('#')[0].replace(/^\//, '')
  if (!existsSync(resolve(root, 'docs', `${page}.md`))) throw new Error(`Missing generated API page: docs/${page}.md`)
}
console.log(`Documentation checks passed (${required.length} required files).`)
