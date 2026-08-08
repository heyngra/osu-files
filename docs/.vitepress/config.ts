import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'vitepress'

const apiSidebar = JSON.parse(readFileSync(new URL('../api/_generated-sidebar.json', import.meta.url), 'utf8'))
const gitRevision = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (!/^[0-9a-f]{40}$/i.test(gitRevision)) throw new Error(`Invalid git revision: ${gitRevision}`)

function wrapApiMembers(state: any) {
  const tokens = state.tokens
  const isApiPage = tokens.some(t => t.type === 'inline' && /^Defined in:/.test(t.content))
  if (!isApiPage) return

  const outlineSections = new Set(['Call Signature', 'Constructors', 'Properties', 'Accessors', 'Methods', 'Enumeration Members', 'Type Declaration'])
  const memberSections = new Set(['Constructors', 'Properties', 'Accessors', 'Methods', 'Enumeration Members', 'Type Declaration'])
  const ignoredHeadings = new Set(['Parameters', 'Returns', 'Get Signature', 'Set Signature', 'Type Parameters', 'Default', 'Throws', 'See', 'Overrides', 'Implementation', 'Implementation of', 'Inherited from'])
  const htmlBlock = (content: string) => ({ type: 'html_block', tag: '', attrs: null, map: null, nesting: 0, level: 0, children: null, content, markup: '', info: '', meta: null, block: true, hidden: false })
  const out: any[] = []
  let open = false
  let outlineMemberCount = 0
  const close = () => { if (open) { out.push(htmlBlock('</div>\n')); open = false } }
  const headingText = (i: number): string | undefined =>
    tokens[i + 1]?.type === 'inline' ? tokens[i + 1].content.trim() : undefined
  const outlineId = (text: string) => {
    const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'member'
    outlineMemberCount++
    return `api-outline-${slug}-${outlineMemberCount}`
  }
  const isRedundantTitle = (i: number) => {
    const text = headingText(i)
    if (!text) return false
    if (text === 'Constructor' || /\(\)$/.test(text)) return true
    const next = tokens[i + 3]
    if (next?.type === 'blockquote_open') return true
    if (next?.type === 'heading_open' && next.tag === 'h4')
      return headingText(i + 3) === 'Get Signature' || headingText(i + 3) === 'Set Signature'
    return false
  }
  const isOutlineMember = (text: string | undefined, redundant: boolean, section: string | undefined) =>
    Boolean(text && redundant && memberSections.has(section ?? '') && text !== 'Constructor' && !/^\[(?:iterator|dispose)\]\(\)$/.test(text) && !ignoredHeadings.has(text))
  const isAccessorHeading = (i: number) => {
    const text = headingText(i)
    return text === 'Get Signature' || text === 'Set Signature'
  }
  let section: string | undefined
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'heading_open' && token.tag === 'h3') {
      close()
      out.push(htmlBlock('<div class="api-member">\n'))
      open = true
      const text = headingText(i)
      const redundant = isRedundantTitle(i)
      if (ignoredHeadings.has(text ?? '')) token.attrJoin('class', 'ignore-header')
      if (isOutlineMember(text, redundant, section)) {
        token.attrJoin('class', 'api-outline-member')
        token.attrSet('id', outlineId(text!))
      } else if (redundant) {
        i += 2
        continue
      }
    } else if (token.type === 'heading_open' && (token.tag === 'h4' || token.tag === 'h5')) {
      token.attrJoin('class', 'ignore-header')
      if (token.tag === 'h4' && isAccessorHeading(i)) {
        i += 2
        continue
      }
    } else if (token.type === 'heading_open' && token.tag === 'h2') {
      const text = headingText(i)
      section = text
      if (text && !outlineSections.has(text)) token.attrJoin('class', 'ignore-header')
      const next = tokens.slice(i + 1).find(t => t.type === 'heading_open')
      if (next?.tag === 'h3') close()
    }
    out.push(token)
  }
  close()
  state.tokens = out
}

function promotableExample(state: any, startLine: number, endLine: number, _silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const firstLine = state.src.slice(start, state.eMarks[startLine]).trimStart()
  if (!firstLine.startsWith('<PromotableExample')) return false

  let openingLine = startLine
  while (openingLine < endLine && !/>\s*$/.test(state.src.slice(state.bMarks[openingLine], state.eMarks[openingLine]))) {
    openingLine++
  }
  if (openingLine >= endLine || !/>\s*$/.test(state.src.slice(state.bMarks[openingLine], state.eMarks[openingLine]))) return false

  let closingLine = openingLine + 1
  while (closingLine < endLine && !/^\s*<\/PromotableExample>\s*$/.test(state.src.slice(state.bMarks[closingLine], state.eMarks[closingLine]))) {
    closingLine++
  }
  if (closingLine >= endLine) return false
  if (_silent) return true

  const openingEnd = openingLine + 1 < state.lineMax ? state.bMarks[openingLine + 1] : state.eMarks[openingLine]
  const innerStart = openingEnd
  const closingStart = state.bMarks[closingLine]
  const opening = state.src.slice(start, openingEnd)
  const inner = state.src.slice(innerStart, closingStart)
  const token = state.push('html_block', '', 0)
  token.map = [startLine, closingLine + 1]
  token.content = `${opening}${state.md.render(inner, state.env)}</PromotableExample>\n`
  state.line = closingLine + 1
  return true
}

function guideSource(state: any, startLine: number, endLine: number, _silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const firstLine = state.src.slice(start, state.eMarks[startLine]).trimStart()
  if (!firstLine.startsWith('<GuideSource')) return false

  let openingLine = startLine
  while (openingLine < endLine && !/>\s*$/.test(state.src.slice(state.bMarks[openingLine], state.eMarks[openingLine]))) openingLine++
  if (openingLine >= endLine) return false

  let closingLine = openingLine + 1
  while (closingLine < endLine && !/^\s*<\/GuideSource>\s*$/.test(state.src.slice(state.bMarks[closingLine], state.eMarks[closingLine]))) closingLine++
  if (closingLine >= endLine) return false
  if (_silent) return true

  const openingEnd = openingLine + 1 < state.lineMax ? state.bMarks[openingLine + 1] : state.eMarks[openingLine]
  const opening = state.src.slice(start, openingEnd)
  const inner = state.src.slice(openingEnd, state.bMarks[closingLine])
  const token = state.push('html_block', '', 0)
  token.map = [startLine, closingLine + 1]
  token.content = `${opening}${state.md.render(inner, state.env)}</GuideSource>\n`
  state.line = closingLine + 1
  return true
}

export default defineConfig({
  vite: {
    define: { __GIT_REVISION__: JSON.stringify(gitRevision) },
    plugins: [{
      name: 'strip-missing-monaco-source-maps',
      enforce: 'pre',
      async load(id: string) {
        const file = id.split('?')[0]
        if (!file.includes('node_modules/monaco-editor/')) return
        const code = await readFile(file, 'utf-8')
        if (!/sourceMappingURL=/.test(code)) return
        return code.replace(/\n?\/\/[#@] sourceMappingURL=.*$/gm, '')
      },
      transform(code: string, id: string) {
        if (!id.includes('node_modules/monaco-editor/')) return
        return { code: code.replace(/\n?\/\/[#@] sourceMappingURL=.*$/gm, ''), map: null }
      },
    }],
    resolve: {
      alias: {
        'monaco-editor/esm/vs/editor/editor.worker': resolve('node_modules/monaco-editor/esm/vs/editor/editor.worker.js'),
        'monaco-editor/esm/vs/language/typescript/ts.worker': resolve('node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js'),
      },
    },
    optimizeDeps: { include: ['monaco-editor'] },
  },
  markdown: {
    config(md) {
      md.block.ruler.before('html_block', 'promotable-example', promotableExample)
      md.block.ruler.before('html_block', 'guide-source', guideSource)
      md.core.ruler.after('block', 'api-members', wrapApiMembers)
    },
  },
  base: '/',
  title: 'osu-files',
  description: 'Node.js tools for osu!lazer Realm data and osu! file formats.',
  cleanUrls: true,
  ignoreDeadLinks: false,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/installation' },
      { text: 'API Reference', link: '/api/' },
    ],
    sidebar: {
      '/guide/': [
        { text: 'Guide', items: [{ text: 'Installation', link: '/guide/installation' }, { text: 'Troubleshooting', link: '/guide/troubleshooting' }] },
        { text: 'Examples', items: [{ text: 'Overview', link: '/guide/examples/' }, { text: 'Beatmaps', link: '/guide/examples/beatmaps' }, { text: 'Collections', link: '/guide/examples/collections' }, { text: 'Replays', link: '/guide/examples/replays' }, { text: 'Skins', link: '/guide/examples/skins' }, { text: 'Keybindings', link: '/guide/examples/keybindings' }] },
      ],
      '/api/': apiSidebar,
    },
    outline: 'deep',
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: 'https://github.com/heyngra/osu-files' }],
    editLink: { pattern: 'https://github.com/heyngra/osu-files/edit/main/docs/:path' },
    footer: { message: 'Released under the MIT License.', copyright: 'heyn ❤️', link: "https://osu.ppy.sh/u/10494504"},
  },
})
