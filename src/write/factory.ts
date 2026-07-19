import { Schema } from '../schema/index.js'
import type { EntityConfig } from './util.js'

type RawSchema = { name: string; primaryKey?: string; embedded?: boolean; properties: Record<string, unknown> }

function parseProp(prop: unknown): { base: string; optional: boolean; isArray: boolean } {
  let raw: string
  let optional = false
  if (typeof prop === 'object' && prop !== null) {
    const p = prop as { type?: string; optional?: boolean }
    raw = p.type ?? ''
    optional = p.optional ?? false
  } else {
    raw = String(prop)
  }
  const isArray = raw.endsWith('[]')
  const base = raw.replace('[]', '').replace('?', '')
  if (raw.endsWith('?') || raw.endsWith('?[]')) optional = true
  return { base, optional, isArray }
}

const configs = (() => {
  const schemas = Schema as unknown as RawSchema[]
  const embedded = new Set(schemas.filter(s => s.embedded).map(s => s.name))
  const allNames = new Set(schemas.map(s => s.name))
  const hasPK = new Set(schemas.filter(s => s.primaryKey).map(s => s.name))

  return schemas
    .filter(s => !embedded.has(s.name) && s.primaryKey)
    .map(schema => {
      const pk = schema.primaryKey!
      const pkInfo = parseProp(schema.properties[pk])

      const required: string[] = [pk]
      const fks: Record<string, string> = {}
      const strip: string[] = []

      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key === pk) continue
        const { base, optional, isArray } = parseProp(prop)
        if (!optional && !isArray && !allNames.has(base))
          required.push(key)
        if (hasPK.has(base)) {
          if (embedded.has(base)) continue
          if (isArray) strip.push(key)
          else fks[key] = base
        }
      }

      const guards: { type: string; filter: string; label: string }[] = []
      for (const other of schemas) {
        if (other.name === schema.name || embedded.has(other.name)) continue
        for (const [key, prop] of Object.entries(other.properties)) {
          const { base, isArray } = parseProp(prop)
          if (base === schema.name && !isArray)
            guards.push({ type: other.name, filter: `${key}.${pk} == $0`, label: other.name })
        }
      }

      return { name: schema.name, pk, pkOptional: pkInfo.optional, required, fks, strip, guards } as EntityConfig<unknown>
    })
})()

export function getConfig(name: string): EntityConfig<unknown> | undefined {
  return configs.find(c => c.name === name)
}
