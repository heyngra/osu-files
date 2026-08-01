import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vitepress'

const apiSidebar = JSON.parse(readFileSync(new URL('../api/_generated-sidebar.json', import.meta.url), 'utf8'))

function wrapApiMembers(state: any) {
  const tokens = state.tokens
  const isApiPage = tokens.some(t => t.type === 'inline' && /^Defined in:/.test(t.content))
  if (!isApiPage) return

  const htmlBlock = (content: string) => ({ type: 'html_block', tag: '', attrs: null, map: null, nesting: 0, level: 0, children: null, content, markup: '', info: '', meta: null, block: true, hidden: false })
  const out: any[] = []
  let open = false
  const close = () => { if (open) { out.push(htmlBlock('</div>\n')); open = false } }
  for (const token of tokens) {
    if (token.type === 'heading_open' && token.tag === 'h3') {
      close()
      out.push(htmlBlock('<div class="api-member">\n'))
      open = true
    } else if (token.type === 'heading_open' && token.tag === 'h2') {
      const next = tokens.slice(tokens.indexOf(token) + 1).find(t => t.type === 'heading_open')
      if (next?.tag === 'h3') close()
    }
    out.push(token)
  }
  close()
  state.tokens = out
}

export default defineConfig({
  vite: {
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
