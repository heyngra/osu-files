import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { apiExcludes } from './api-excludes.js'
import { policyForExample, type ApiExampleExecution } from './api-example-registry.js'
import { templateForReflection } from './api-example-templates.js'

export type Reflection = {
  id?: number
  name: string
  kind: number
  sources?: Array<{ fileName?: string; line?: number }>
  comment?: CommentBlock
  signatures?: Array<{ comment?: CommentBlock; parameters?: Array<{ name: string }> }>
  children?: Reflection[]
}

type CommentContent = { kind?: string; text?: string }
type CommentTag = { tag?: string; content?: CommentContent[] | string }
type CommentBlock = { blockTags?: CommentTag[] }

export type ApiExample = {
  id: string
  target: string
  ordinal: number
  code: string
  execution: ApiExampleExecution
  fixture?: string
  output?: string
  documentationPage: string
  sourceFile: string
  sourceLine: number
  kind: string
  placement: ApiExamplePlacement
}

export type ApiExamplePlacement =
  | { kind: 'declaration' }
  | { kind: 'member'; anchor: string }

export type ApiExampleModel = {
  examples: ApiExample[]
  byTarget: Record<string, string[]>
}

const kindNames: Record<number, string> = {
  8: 'enum',
  64: 'function',
  128: 'class',
  256: 'interface',
  512: 'constructor',
  1024: 'property',
  2048: 'method',
  262144: 'accessor',
  2097152: 'type',
}

const pageGroups: Record<string, string> = {
  class: 'classes',
  enum: 'enumerations',
  function: 'functions',
  interface: 'interfaces',
  type: 'type-aliases',
}

function sourceFile(reflection: Reflection, fallback = 'src/index.ts'): string {
  const file = reflection.sources?.[0]?.fileName
  if (!file) return fallback
  return file.startsWith('src/') ? file : `src/${file}`
}

function sourceLine(reflection: Reflection, fallback = 0): number {
  return reflection.sources?.[0]?.line ?? fallback
}

function memberAnchor(kind: string, name: string): string {
  const slug = name.toLowerCase()
  return kind === 'enum-member' ? `#enumeration-member-${slug}` : `#${slug}`
}

function contentText(content: CommentContent[] | string | undefined): string {
  if (typeof content === 'string') return content
  return (content ?? []).map(item => item.text ?? '').join('')
}

function stripFence(value: string): string {
  const text = value.replace(/\r\n/g, '\n').trim()
  const fenced = text.match(/^```(?:typescript|ts|javascript|js)?\n([\s\S]*?)\n```$/)
  return (fenced?.[1] ?? text).trim()
}

function isUsableCode(code: string): boolean {
  if (!code || code.includes('...')) return false
  if (/^\/\/\s*(?:access|see)\b/i.test(code)) return false
  if (/^['"`]?\w+['"`]?\s*$/.test(code)) return false
  return true
}

function documentedExamples(reflection: Reflection): string[] {
  const comments: CommentBlock[] = [
    ...(reflection.comment ? [reflection.comment] : []),
    ...(reflection.signatures ?? []).flatMap(signature => signature.comment ? [signature.comment] : []),
  ]
  const result: string[] = []
  for (const comment of comments) {
    for (const tag of comment.blockTags ?? []) {
      if (tag.tag !== '@example') continue
      const code = stripFence(contentText(tag.content))
      if (isUsableCode(code) && !result.includes(code)) result.push(code)
    }
  }
  return result
}

function publicChildren(reflection: Reflection): Reflection[] {
  return (reflection.children ?? []).filter(child => {
    if (![512, 2048, 262144].includes(child.kind)) return false
    if (child.name.startsWith('_')) return false
    if (child.name === '[iterator]' || child.name === '[dispose]') return false
    return true
  })
}

function rootReflections(data: { children?: Reflection[] }): Reflection[] {
  const root = data.children?.find(child => child.name === 'index')
  return (root?.children ?? data.children ?? []).filter(reflection => !apiExcludes.includes(reflection.name))
}

function pageFor(reflection: Reflection, parent?: { page: string; sourceFile: string }): string {
  const kind = kindNames[reflection.kind]
  if (parent && kind) return `${parent.page}${memberAnchor(kind, reflection.name)}`
  const group = pageGroups[kind] ?? 'types'
  return `/api/generated/${group}/${reflection.name}`
}

function idFor(target: string, ordinal: number): string {
  const slug = target.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  return `api-${slug}-${ordinal + 1}`
}

function chooseCode(reflection: Reflection, parent: Reflection | undefined, ordinal: number, documented: string[]): string {
  const code = documented[ordinal] ?? templateForReflection(reflection, parent)
  const symbol = parent?.name ?? reflection.name
  if (/from\s+['"]osu-files['"]/.test(code)) return code
  if (reflection.name === 'init' && !parent) return `import init from 'osu-files'\n\n${code}`
  if (reflection.kind === 2097152 || reflection.kind === 256) return `import type { ${reflection.name} } from 'osu-files'\n\n${code}`
  if (parent || [64, 128, 8].includes(reflection.kind)) return `import { ${symbol} } from 'osu-files'\n\n${code}`
  return code
}

export function buildApiExampleModel(data: { children?: Reflection[] }): ApiExampleModel {
  const examples: ApiExample[] = []
  const byTarget: Record<string, string[]> = {}

  const visit = (reflection: Reflection, parent?: Reflection, parentPage?: string, parentSource?: string): void => {
    const kind = kindNames[reflection.kind]
    if (!kind || apiExcludes.includes(reflection.name)) return

    const isTopLevel = !parent
    const isExampleTarget = isTopLevel
      ? [64, 128, 256, 8, 2097152].includes(reflection.kind)
      : [512, 2048, 262144].includes(reflection.kind)

    const target = parent ? `${parent.name}.${reflection.name}` : reflection.name
    const page = pageFor(reflection, parentPage ? { page: parentPage, sourceFile: parentSource ?? 'src/index.ts' } : undefined)
    const currentSource = sourceFile(reflection, parentSource ?? 'src/index.ts')

    if (isExampleTarget) {
      const documented = documentedExamples(reflection)
      const sourceCode = documented.length ? documented : [templateForReflection(reflection, parent)]
      for (let ordinal = 0; ordinal < sourceCode.length; ordinal++) {
        const code = chooseCode(reflection, parent, ordinal, sourceCode)
        const policy = policyForExample(target, code)
        const example: ApiExample = {
          id: idFor(target, ordinal),
          target,
          ordinal,
          code,
          execution: policy.execution,
          fixture: policy.fixture,
          documentationPage: page,
          sourceFile: currentSource,
          sourceLine: sourceLine(reflection, parent ? sourceLine(parent) : 0),
          kind,
          placement: parent
            ? { kind: 'member', anchor: memberAnchor(kind, reflection.name).slice(1) }
            : { kind: 'declaration' },
        }
        examples.push(example)
        ;(byTarget[target] ??= []).push(example.id)
      }
    }

    if (isTopLevel && (reflection.kind === 128 || reflection.kind === 256 || reflection.kind === 2097152)) {
      for (const child of publicChildren(reflection)) visit(child, reflection, page, currentSource)
    }
  }

  for (const reflection of rootReflections(data)) visit(reflection)
  examples.sort((left, right) => left.id.localeCompare(right.id))
  return { examples, byTarget }
}

export function readTypedocData(): { children?: Reflection[] } {
  return JSON.parse(readFileSync(resolve('docs/.generated/typedoc.json'), 'utf8')) as { children?: Reflection[] }
}
