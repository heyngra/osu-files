export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type ParsedOutput =
  | { kind: 'json'; value: JsonValue }
  | { kind: 'text'; value: string }

export function serializeOutput(value: unknown): string {
  const seen = new WeakSet<object>()
  return JSON.stringify(value, (_key, current: unknown) => {
    if (typeof current === 'bigint') return `${current}n`
    if (current instanceof Uint8Array) return { type: 'Uint8Array', length: current.length, bytes: Array.from(current.slice(0, 32)) }
    if (current instanceof Date) return current.toISOString()
    if (typeof current === 'object' && current !== null) {
      if (seen.has(current)) return '[Circular]'
      seen.add(current)
    }
    if (typeof current === 'function') return `[Function ${current.name || 'anonymous'}]`
    return current
  }, 2) ?? String(value)
}

export function parseSerializedOutput(serialized: string | undefined): ParsedOutput {
  const value = serialized ?? ''
  try {
    return { kind: 'json', value: JSON.parse(value) as JsonValue }
  } catch {
    return { kind: 'text', value }
  }
}
