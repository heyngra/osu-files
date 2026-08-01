import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseSerializedOutput, serializeOutput } from '../../docs/.vitepress/runner/output.js'

describe('documentation example output', () => {
  it('parses JSON objects, arrays, primitives, and null', () => {
    assert.deepStrictEqual(parseSerializedOutput('{"name":"osu"}'), { kind: 'json', value: { name: 'osu' } })
    assert.deepStrictEqual(parseSerializedOutput('[1,true,"text"]'), { kind: 'json', value: [1, true, 'text'] })
    assert.deepStrictEqual(parseSerializedOutput('42'), { kind: 'json', value: 42 })
    assert.deepStrictEqual(parseSerializedOutput('null'), { kind: 'json', value: null })
  })

  it('keeps JSON-looking strings as string values', () => {
    assert.deepStrictEqual(parseSerializedOutput(JSON.stringify('{"nested":true}')), { kind: 'json', value: '{"nested":true}' })
  })

  it('falls back to plain text for non-JSON output', () => {
    assert.deepStrictEqual(parseSerializedOutput('undefined'), { kind: 'text', value: 'undefined' })
    assert.deepStrictEqual(parseSerializedOutput('Running…'), { kind: 'text', value: 'Running…' })
  })

  it('preserves safe serialization for special and circular values', () => {
    const circular: Record<string, unknown> = { value: 1 }
    circular.self = circular
    const serialized = serializeOutput({ big: 4n, date: new Date('2024-01-02T03:04:05.000Z'), bytes: new Uint8Array([1, 2, 3]), circular })

    assert.doesNotThrow(() => JSON.parse(serialized))
    assert.match(serialized, /"big": "4n"/)
    assert.match(serialized, /"type": "Uint8Array"/)
    assert.match(serialized, /\[Circular\]/)
    assert.equal(parseSerializedOutput(serialized).kind, 'json')
  })
})
