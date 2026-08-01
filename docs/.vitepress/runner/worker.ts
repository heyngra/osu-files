import * as api from '../pure-api.js'
import { serializeOutput } from './output.js'
import { transformExample } from './import-transformer.js'

type RunMessage = { source: string; fixtureUrl: string }
let active = 0

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  const runId = ++active
  const logs: Array<{ level: string; args: string[] }> = []
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error }
  for (const level of Object.keys(original) as Array<keyof typeof original>) {
    console[level] = (...args: unknown[]) => logs.push({ level, args: args.map(serializeOutput) })
  }
  try {
    const fixture = await fetch(event.data.fixtureUrl).then(response => response.json())
    const transformed = transformExample(event.data.source)
    const bindings: Record<string, unknown> = {}
    for (const name of transformed.names) bindings[name] = name === 'fixture' ? fixture : (api as Record<string, unknown>)[name]
    for (const [name, value] of Object.entries(fixture as Record<string, unknown>)) if (!(name in bindings)) bindings[name] = value
    const names = Object.keys(bindings)
    const values = names.map(name => bindings[name])
    const run = new Function(...names, `return (async () => {\n${transformed.code}\n})()`)
    const value = await run(...values)
    if (runId === active) self.postMessage({ value: serializeOutput(value), logs })
  } catch (error) {
    if (runId === active) self.postMessage({ error: error instanceof Error ? error.message : String(error), logs })
  } finally {
    console.log = original.log; console.info = original.info; console.warn = original.warn; console.error = original.error
  }
}
