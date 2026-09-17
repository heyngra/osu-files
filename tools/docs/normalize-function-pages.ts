import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const functionsDir = join(process.cwd(), 'docs', 'api', 'generated', 'functions')

function normalize(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const title = lines[0] ?? ''
  if (!title.startsWith('# Function: ') || lines.some(l => l.startsWith('## Call Signature'))) return markdown

  let i = 1
  while (i < lines.length && lines[i].trim() === '') i++

  const signature: string[] = []
  while (i < lines.length && lines[i].startsWith('>')) { signature.push(lines[i]); i++ }
  while (i < lines.length && lines[i].trim() === '') i++

  const header: string[] = []
  while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('## ')) { header.push(lines[i]); i++ }
  while (i < lines.length && lines[i].trim() === '') i++

  const description: string[] = []
  while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('## ')) { description.push(lines[i]); i++ }

  const sections = lines.slice(i)
  let fenced = false
  for (let k = 0; k < sections.length; k++) {
    if (/^```/.test(sections[k].trim())) fenced = !fenced
    else if (!fenced && sections[k].startsWith('## ')) sections[k] = sections[k].replace(/^## /, '### ')
  }

  const out: string[] = [title]
  if (description.length) out.push('', description.join('\n'))
  out.push('', '## Call Signature', '', signature.join('\n'), '', header.join('\n'))
  const tail = sections.join('\n')
  if (tail.trim()) out.push('', tail.replace(/^\n+/, '').replace(/\n+$/, ''))
  return out.join('\n') + '\n'
}

let normalized = 0
for (const entry of readdirSync(functionsDir)) {
  if (!entry.endsWith('.md')) continue
  const path = join(functionsDir, entry)
  const content = readFileSync(path, 'utf8')
  const result = normalize(content)
  if (result !== content) {
    writeFileSync(path, result)
    console.log(`Normalized ${entry}`)
    normalized++
  }
}
console.log(normalized ? `Normalized ${normalized} function page(s).` : 'No function pages needed normalization.')
