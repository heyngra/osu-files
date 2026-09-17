import { readFileSync } from 'node:fs'
import { generateFacadePages } from './facade-examples.js'

const data = JSON.parse(readFileSync('docs/.generated/typedoc.json', 'utf8'))
const examples = await generateFacadePages(data)
console.log(`Generated and checked ${examples.length} facade examples.`)
process.exit(0)
