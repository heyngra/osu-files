import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import type { GuideMetadata } from './guide-schema.js'

export type GuideBlock =
  | { kind: 'markdown'; content: string }
  | { kind: 'code'; name: string; content: string; startLine: number; endLine: number }
  | { kind: 'note' | 'warning'; content: string }

export type GuideExample = {
  slug: string
  group: string
  groupTitle?: string
  groupOrder?: number
  groupSummary?: string
  title: string
  order: number
  summary: string
  api: string[]
  sourcePath: string
  language: 'js' | 'ts'
  blocks: GuideBlock[]
}

type ApiItem = { publicSymbol: string; memberPath?: string; documentationPage: string }

function commentLines(comment: string): string[] {
  const lines = comment
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*\* ?/, '').replace(/\s+$/, ''))
  while (lines[0] === '') lines.shift()
  while (lines.at(-1) === '') lines.pop()
  return lines
}

function commentBody(lines: string[]): string {
  const first = lines[0].replace(/^@docs(?:-note|-warning)?\s*/, '')
  const body = [first, ...lines.slice(1)]
  while (body[0] === '') body.shift()
  while (body.at(-1) === '') body.pop()
  return body.join('\n')
}

function commonIndent(value: string): string {
  const lines = value.replace(/^\s*\r?\n/, '').replace(/\s+$/, '').split(/\r?\n/)
  const indents = lines.filter(line => line.trim()).map(line => line.match(/^\s*/)?.[0].length ?? 0)
  const indent = indents.length ? Math.min(...indents) : 0
  return lines.map(line => line.slice(indent)).join('\n')
}

function lineAt(source: string, offset: number): number {
  let line = 1
  for (let index = 0; index < offset; index++) if (source.charCodeAt(index) === 10) line++
  return line
}

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  if (!property.name) return undefined
  return ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : undefined
}

function metadataValue(property: ts.PropertyAssignment, file: string): string | number | string[] {
  const value = property.initializer
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text
  if (ts.isNumericLiteral(value)) return Number(value.text)
  if (ts.isArrayLiteralExpression(value)) return value.elements.map(element => {
    if (!ts.isStringLiteral(element) && !ts.isNoSubstitutionTemplateLiteral(element)) throw new Error(`${file}: guide.api must contain strings`)
    return element.text
  })
  throw new Error(`${file}: guide.${propertyName(property)} must be a literal value`)
}

function parseMetadata(sourceFile: ts.SourceFile, file: string): GuideMetadata {
  const declarations: ts.VariableDeclaration[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'guide') declarations.push(node)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (declarations.length !== 1) throw new Error(`${file}: expected one guide metadata object`)
  const satisfies = ts.getJSDocSatisfiesTag(declarations[0])
  if (!satisfies || !satisfies.typeExpression.type.getText(sourceFile).endsWith('.GuideMetadata')) {
    throw new Error(`${file}: guide needs a @satisfies GuideMetadata annotation`)
  }
  const initializer = declarations[0].initializer
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) throw new Error(`${file}: guide must be an object literal`)

  const values = new Map<string, string | number | string[]>()
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) throw new Error(`${file}: guide metadata only supports property assignments`)
    const name = propertyName(property)
    if (!name) throw new Error(`${file}: guide metadata needs plain property names`)
    if (values.has(name)) throw new Error(`${file}: duplicate guide.${name}`)
    values.set(name, metadataValue(property, file))
  }
  const string = (name: string, required = false) => {
    const value = values.get(name)
    if (required && typeof value !== 'string') throw new Error(`${file}: missing guide.${name}`)
    if (value !== undefined && typeof value !== 'string') throw new Error(`${file}: guide.${name} must be a string`)
    return value as string | undefined
  }
  const number = (name: string, required = false) => {
    const value = values.get(name)
    if (required && typeof value !== 'number') throw new Error(`${file}: missing guide.${name}`)
    if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value))) throw new Error(`${file}: guide.${name} must be an integer`)
    return value as number | undefined
  }
  const known = new Set(['group', 'groupTitle', 'groupOrder', 'groupSummary', 'title', 'order', 'summary', 'api'])
  for (const name of values.keys()) if (!known.has(name)) throw new Error(`${file}: unknown guide.${name}`)
  const api = values.get('api')
  if (api !== undefined && !Array.isArray(api)) throw new Error(`${file}: guide.api must be an array`)
  return {
    group: string('group', true)! as GuideMetadata['group'],
    groupTitle: string('groupTitle'),
    groupOrder: number('groupOrder'),
    groupSummary: string('groupSummary'),
    title: string('title', true)!,
    order: number('order', true)!,
    summary: string('summary', true)!,
    api: api as string[] | undefined,
  }
}

export function parseGuideSource(file: string, source = readFileSync(file, 'utf8')): GuideExample {
  const extension = extname(file)
  if (extension !== '.js' && extension !== '.ts') throw new Error(`${file}: guide entrypoint must be JavaScript or TypeScript`)

  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, extension === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS)
  const ranges = new Map<number, ts.CommentRange>()
  const addRanges = (items: ts.CommentRange[] | undefined) => {
    for (const item of items ?? []) if (item.kind === ts.SyntaxKind.MultiLineCommentTrivia) ranges.set(item.pos, item)
  }
  const collectComments = (node: ts.Node) => {
    addRanges(ts.getLeadingCommentRanges(source, node.getFullStart()))
    addRanges(ts.getTrailingCommentRanges(source, node.getEnd()))
    for (const child of node.getChildren(sourceFile)) collectComments(child)
  }
  collectComments(sourceFile)

  const metadata = parseMetadata(sourceFile, file)
  const blocks: GuideBlock[] = []
  let region: { name: string; start: number } | undefined

  for (const range of [...ranges.values()].sort((left, right) => left.pos - right.pos)) {
    const text = source.slice(range.pos, range.end)
    const lines = commentLines(text)
    const directive = lines[0].trim()

    const start = directive.match(/^@docs:start\s+([\w-]+)$/)
    if (start) {
      if (region) throw new Error(`${file}: region ${region.name} overlaps ${start[1]}`)
      region = { name: start[1], start: range.end }
      continue
    }

    const end = directive.match(/^@docs:end\s+([\w-]+)$/)
    if (end) {
      if (!region) throw new Error(`${file}: @docs:end ${end[1]} has no matching start`)
      if (region.name !== end[1]) throw new Error(`${file}: expected @docs:end ${region.name}, found ${end[1]}`)
      const raw = source.slice(region.start, range.pos)
      const content = commonIndent(raw)
      if (!content) throw new Error(`${file}: region ${region.name} is empty`)
      const leading = raw.match(/^(?:[\t ]*\r?\n)+/)?.[0].length ?? 0
      const contentEnd = region.start + raw.trimEnd().length - 1
      blocks.push({
        kind: 'code',
        name: region.name,
        content,
        startLine: lineAt(source, region.start + leading),
        endLine: lineAt(source, contentEnd),
      })
      region = undefined
      continue
    }

    if (region) continue
    if (directive === '@docs' || directive.startsWith('@docs ')) blocks.push({ kind: 'markdown', content: commentBody(lines) })
    if (directive === '@docs-note' || directive.startsWith('@docs-note ')) blocks.push({ kind: 'note', content: commentBody(lines) })
    if (directive === '@docs-warning' || directive.startsWith('@docs-warning ')) blocks.push({ kind: 'warning', content: commentBody(lines) })
  }

  if (region) throw new Error(`${file}: region ${region.name} has no matching end`)
  if (!blocks.length) throw new Error(`${file}: guide has no documentation blocks`)

  return {
    ...metadata,
    api: [...(metadata.api ?? [])],
    slug: basename(resolve(file, '..')),
    sourcePath: relative(resolve('.'), file).replaceAll('\\', '/'),
    language: extension.slice(1) as 'js' | 'ts',
    blocks,
  }
}

export function readGuides(examplesDirectory = resolve('examples')): GuideExample[] {
  return readdirSync(examplesDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const directory = join(examplesDirectory, entry.name)
      const entrypoint = ['index.ts', 'index.js'].map(name => join(directory, name)).find(file => ts.sys.fileExists(file))
      if (!entrypoint) throw new Error(`${directory}: missing index.js or index.ts`)
      return parseGuideSource(entrypoint)
    })
}

function groupMetadata(examples: GuideExample[]) {
  const title = examples.filter(example => example.groupTitle)
  const order = examples.filter(example => example.groupOrder !== undefined)
  const summary = examples.filter(example => example.groupSummary)
  if (title.length !== 1 || order.length !== 1 || summary.length !== 1) {
    throw new Error(`Group ${examples[0].group} needs exactly one groupTitle, groupOrder, and groupSummary`)
  }
  return { slug: examples[0].group, title: title[0].groupTitle!, order: order[0].groupOrder!, summary: summary[0].groupSummary! }
}

function apiLinks(example: GuideExample, manifest: ApiItem[]): string {
  if (!example.api.length) return ''
  const links = example.api.map(target => {
    const item = manifest.find(entry => entry.publicSymbol === target || entry.memberPath === target)
    if (!item) throw new Error(`${example.sourcePath}: unknown @api target ${target}`)
    const label = target.startsWith('OsuFilesAPI.') ? target.replace('.', '#') : target
    return `[\`${label}\`](${item.documentationPage})`
  })
  return `**API used:** ${links.join(' · ')}`
}

function renderBlock(block: GuideBlock, example: GuideExample): string {
  if (block.kind === 'code') {
    return `<GuideSource source="${example.sourcePath}" :start-line="${block.startLine}" :end-line="${block.endLine}">\n\n\`\`\`${example.language}\n${block.content}\n\`\`\`\n\n</GuideSource>`
  }
  if (block.kind === 'markdown') return block.content
  return `> [!${block.kind === 'note' ? 'NOTE' : 'WARNING'}]\n> ${block.content.replaceAll('\n', '\n> ')}`
}

export function renderGuidePages(examples: GuideExample[], manifest: ApiItem[]): Map<string, string> {
  const grouped = Map.groupBy(examples, example => example.group)
  const groups = [...grouped.values()].map(items => ({ metadata: groupMetadata(items), examples: items.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)) }))
    .sort((a, b) => a.metadata.order - b.metadata.order || a.metadata.slug.localeCompare(b.metadata.slug))
  const generated = '<!-- Generated from examples/*/index.js or index.ts. Do not edit this file directly. -->'
  const pages = new Map<string, string>()

  const overview = [
    generated,
    '',
    '# Examples',
    '',
    'The examples in this repository are small programs you can run against your own osu!lazer data. Their source files also contain the text shown in this guide.',
    '',
    '## Running an example',
    '',
    '```sh',
    'cd examples/<name>',
    'npm install',
    'npm start',
    '```',
    '',
    '## Available examples',
    '',
    ...groups.map(group => `- [${group.metadata.title}](/guide/examples/${group.metadata.slug}) - ${group.metadata.summary}`),
    '',
  ].join('\n')
  pages.set('index.md', overview)

  for (const group of groups) {
    const lines = [
      generated,
      '',
      '<script setup lang="ts">',
      "import GuideSource from '../../.vitepress/components/GuideSource.vue'",
      '</script>',
      '',
      `# ${group.metadata.title}`,
      '',
      group.metadata.summary,
      '',
    ]
    for (const example of group.examples) {
      const packageJson = JSON.parse(readFileSync(resolve(example.sourcePath, '../package.json'), 'utf8')) as { scripts?: { start?: string } }
      if (!packageJson.scripts?.start) throw new Error(`${example.sourcePath}: package.json needs a start script`)
      lines.push(
        `## ${example.title}`,
        '',
        example.summary,
        '',
        `[Full source](https://github.com/heyngra/osu-files/blob/main/${example.sourcePath})`,
        '',
        '```sh',
        `cd examples/${example.slug}`,
        'npm install',
        'npm start',
        '```',
        '',
        ...example.blocks.flatMap(block => [renderBlock(block, example), '']),
      )
      const links = apiLinks(example, manifest)
      if (links) lines.push(links, '')
    }
    pages.set(`${group.metadata.slug}.md`, `${lines.join('\n').trimEnd()}\n`)
  }
  return pages
}

export function generateGuides(root = resolve('.')): Map<string, string> {
  const examples = readGuides(join(root, 'examples'))
  const manifest = JSON.parse(readFileSync(join(root, 'docs/.generated/api-manifest.json'), 'utf8')) as ApiItem[]
  const pages = renderGuidePages(examples, manifest)
  const output = join(root, 'docs/guide/examples')
  for (const [name, content] of pages) writeFileSync(join(output, name), content)
  writeFileSync(join(root, 'docs/.generated/guides.json'), `${JSON.stringify(examples, null, 2)}\n`)
  return pages
}
