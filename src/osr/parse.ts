import { createHash } from 'crypto'
import { createRequire } from 'node:module'
import type { ParsedReplay, ParsedExtra, ReplayFrame, LifeBarFrame } from './types.js'
import { GameMode, LegacyMods } from './types.js'

const _require = createRequire(import.meta.url)
const LZMA = _require('lzma-web/dist/lzma_worker.js').LZMA

/**
 * Parses a .osr replay buffer into structured data.
 * @returns Parsed replay object.
 * @example
 * parseOsr(buffer) // { mode: 0, playerName: '...', replayFrames: [...], ... }
 */
export function parseOsr(buffer: Buffer): ParsedReplay {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const ptr = { value: 0 }

  const mode = view.getUint8(ptr.value++)
  const gameVersion = view.getInt32(ptr.value, true); ptr.value += 4
  const beatmapMD5 = readString(view, ptr)
  const playerName = readString(view, ptr)
  const replayMD5 = readString(view, ptr)
  const count300 = view.getUint16(ptr.value, true); ptr.value += 2
  const count100 = view.getUint16(ptr.value, true); ptr.value += 2
  const count50 = view.getUint16(ptr.value, true); ptr.value += 2
  const countGeki = view.getUint16(ptr.value, true); ptr.value += 2
  const countKatu = view.getUint16(ptr.value, true); ptr.value += 2
  const countMiss = view.getUint16(ptr.value, true); ptr.value += 2
  const totalScore = view.getInt32(ptr.value, true); ptr.value += 4
  const maxCombo = view.getUint16(ptr.value, true); ptr.value += 2
  const perfectCombo = view.getUint8(ptr.value++) !== 0
  const modsValue = view.getInt32(ptr.value, true); ptr.value += 4
  const lifeBarRaw = readString(view, ptr)
  const timestampTicks = view.getBigInt64(ptr.value, true); ptr.value += 8
  const replayDataLength = view.getInt32(ptr.value, true); ptr.value += 4
  const rawReplayData = buffer.subarray(ptr.value, ptr.value + replayDataLength)
  ptr.value += replayDataLength
  const onlineScoreID = Number(view.getBigInt64(ptr.value, true)); ptr.value += 8

  let rawExtraData: Buffer | null = null
  let parsedExtra: ParsedExtra | null = null
  if (ptr.value < buffer.length) {
    const extraLen = view.getInt32(ptr.value, true); ptr.value += 4
    rawExtraData = buffer.subarray(ptr.value, ptr.value + extraLen)
    ptr.value += extraLen
    try {
      const decompressed = decompressLzma(rawExtraData)
      parsedExtra = JSON.parse(decompressed)
    } catch {
    }
  }

  let additionalMods: number | undefined
  if ((modsValue >>> 0) & (1 << 23)) {
    additionalMods = view.getFloat64(ptr.value, true)
  }

  const mods = LegacyMods.from(modsValue)

  let replayFrames: ReplayFrame[] = []
  if (rawReplayData.length > 0) {
    try {
      const decompressed = decompressLzma(rawReplayData)
      replayFrames = parseReplayFrames(decompressed)
    } catch {
    }
  }

  return {
    mode: mode as GameMode,
    gameVersion,
    beatmapMD5,
    playerName,
    replayMD5,
    count300,
    count100,
    count50,
    countGeki,
    countKatu,
    countMiss,
    totalScore,
    maxCombo,
    perfectCombo,
    mods,
    lifeBarGraph: parseLifeBar(lifeBarRaw),
    timestamp: ticksToDate(timestampTicks),
    timestampTicks,
    onlineScoreID,
    additionalMods,
    rawReplayData: Buffer.from(rawReplayData),
    replayFrames,
    rawExtraData,
    parsedExtra,
  }
}

/**
 * Parses replay frames from a decompressed comma-separated string. Lazer
 * stores each frame as `delta|x|y|keys`; the legacy flat scalar form is also
 * accepted for callers that use this standalone helper.
 * @returns Array of replay frames.
 * @example
 * parseReplayFrames('0|100|200|1,16|101|201|0') // [{ timeDelta: 0, mouseX: 100, ... }, ...]
 */
export function parseReplayFrames(data: string): ReplayFrame[] {
  if (!data) return []
  const records = data.split(',').map(part => part.trim()).filter(Boolean)
  const frames: ReplayFrame[] = []
  if (records.some(record => record.includes('|'))) {
    for (const record of records) {
      const parts = record.split('|')
      if (parts.length < 4) continue
      const timeDelta = Number.parseInt(parts[0], 10)
      const mouseX = Number.parseFloat(parts[1])
      const mouseY = Number.parseFloat(parts[2])
      const keys = Number.parseInt(parts[3], 10)
      if (timeDelta === -12345) continue
      if (![timeDelta, mouseX, mouseY, keys].every(Number.isFinite)) continue
      frames.push({ timeDelta, mouseX, mouseY, keys })
    }
    return frames
  }

  for (let i = 0; i + 3 < records.length; i += 4) {
    const values = records.slice(i, i + 4).map(value => Number(value))
    if (!values.every(Number.isFinite)) continue
    frames.push({ timeDelta: values[0], mouseX: values[1], mouseY: values[2], keys: values[3] })
  }
  return frames
}

function parseLifeBar(raw: string): LifeBarFrame[] {
  if (!raw) return []
  return raw.split(',').map(pair => {
    const [t, hp] = pair.split('|')
    return { time: parseInt(t, 10) || 0, hp: parseFloat(hp) || 0 }
  })
}

/**
 * Decompresses LZMA-compressed data to a UTF-8 string.
 * @returns Decompressed UTF-8 string.
 * @example
 * decompressLzma(lzmaBuffer) // '0,100,200,1,...'
 */
export function decompressLzma(data: Buffer | Uint8Array): string {
  const decoded = LZMA.decompress(new Uint8Array(data))
  return Buffer.from(decoded as Uint8Array).toString('utf-8')
}

/**
 * Reads a 0x0b-prefixed UTF-8 string from a DataView at a mutable pointer.
 * @returns Decoded string.
 * @example
 * readString(view, { value: 42 }) // 'player_name'
 */
export function readString(view: DataView, ptr: { value: number }): string {
  const marker = view.getUint8(ptr.value++)
  if (marker === 0x00) return ''
  if (marker !== 0x0b) return ''

  const length = read7bitInt(view, ptr)
  if (length === 0) return ''

  const dec = new TextDecoder()
  const str = dec.decode(new Uint8Array(view.buffer, view.byteOffset + ptr.value, length))
  ptr.value += length
  return str
}

/**
 * Reads a 7-bit variable-length encoded integer from a DataView.
 * @returns Decoded integer.
 * @example
 * read7bitInt(view, { value: 10 }) // 12345
 */
export function read7bitInt(view: DataView, ptr: { value: number }): number {
  let value = 0
  let shift = 0
  while (true) {
    const byte = view.getUint8(ptr.value++)
    value |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) break
    shift += 7
  }
  return value
}

const TICKS_EPOCH = 621355968000000000n

/**
 * Converts .NET ticks (100-nanosecond intervals since 1/1/0001) to a Date.
 * @returns Converted Date.
 * @example
 * ticksToDate(637709184000000000n) // Date
 */
export function ticksToDate(ticks: bigint): Date {
  return new Date(Number((ticks - TICKS_EPOCH) / 10000n))
}

/**
 * Converts a Date to .NET ticks.
 * @returns .NET ticks as bigint.
 * @example
 * dateToTicks(new Date()) // 637709184000000000n
 */
export function dateToTicks(date: Date): bigint {
  return BigInt(date.getTime()) * 10000n + TICKS_EPOCH
}

/**
 * Computes the lazer replay MD5 hash for a given player and timestamp.
 * @returns 32-char hex replay MD5.
 * @example
 * computeReplayMD5('player', new Date()) // 'a1b2c3d4...'
 */
export function computeReplayMD5(username: string, timestamp: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const offsetMinutes = -timestamp.getTimezoneOffset()
  const absoluteOffset = Math.abs(offsetMinutes)
  const tz = `${offsetMinutes >= 0 ? '+' : '-'}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`
  const fmt = `${pad(timestamp.getMonth() + 1)}/${pad(timestamp.getDate())}/${timestamp.getFullYear()} ${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())} ${tz}`
  return createHash('md5').update(`lazer-${username}-${fmt}`).digest('hex')
}

/**
 * Writes a 0x0b-prefixed UTF-8 string to a Buffer array.
 * @example
 * writeString(buffers, 'hello') // pushes [0x0b, 0x05, ...'hello'] into buffers
 */
export function writeString(buffer: Buffer[], str: string): void {
  if (!str) {
    buffer.push(Buffer.from([0x0b, 0x00]))
    return
  }
  const encoded = Buffer.from(str, 'utf-8')
  const lenBuf: number[] = []
  let len = encoded.length
  while (len >= 0x80) {
    lenBuf.push((len & 0x7f) | 0x80)
    len >>= 7
  }
  lenBuf.push(len)
  buffer.push(Buffer.from([0x0b]))
  buffer.push(Buffer.from(lenBuf))
  buffer.push(encoded)
}
