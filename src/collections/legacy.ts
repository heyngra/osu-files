const SENTINEL_NULL = 0x00
const SENTINEL_STRING = 0x0B
const LEGACY_VERSION = 0x01343DCB // 20230907

/** A single collection entry from the legacy binary format. */
export type LegacyCollectionEntry = {
  /** Collection display name. */
  name: string
  /** MD5 hashes of beatmaps in this collection. */
  beatmapMD5s: string[]
}

/** Options for reading a legacy collection.db buffer. */
export type ReadLegacyCollectionOptions = {
  /** Include the file format version in the result. */
  includeVersion?: boolean
}

function write7bitInt(buf: Buffer, offset: number, value: number): number {
  let written = 0
  while (value > 0x7F) {
    buf.writeUInt8((value & 0x7F) | 0x80, offset + written)
    value >>>= 7
    written++
  }
  buf.writeUInt8(value & 0x7F, offset + written)
  return written + 1
}

function read7bitInt(buffer: Buffer, offset: number): [number, number] {
  let result = 0
  let shift = 0
  let bytesRead = 0
  while (true) {
    const byte = buffer.readUInt8(offset + bytesRead)
    result |= (byte & 0x7F) << shift
    bytesRead++
    if (!(byte & 0x80)) break
    shift += 7
  }
  return [result, bytesRead]
}

function legacyStringSize(str: string): number {
  const utf8Len = Buffer.byteLength(str, 'utf8')
  let lenSize = 1
  let len = utf8Len
  while (len > 0x7F) { lenSize++; len >>>= 7 }
  return 1 + lenSize + utf8Len
}

function writeLegacyString(buf: Buffer, offset: number, str: string | null): number {
  if (str === null) {
    buf.writeUInt8(SENTINEL_NULL, offset)
    return 1
  }
  buf.writeUInt8(SENTINEL_STRING, offset)
  const utf8 = Buffer.from(str, 'utf8')
  const lenSize = write7bitInt(buf, offset + 1, utf8.length)
  utf8.copy(buf, offset + 1 + lenSize)
  return 1 + lenSize + utf8.length
}

function readLegacyString(buffer: Buffer, offset: number): [string | null, number] {
  const sentinel = buffer.readUInt8(offset)
  if (sentinel === SENTINEL_NULL) return [null, 1]
  const [byteLen, lenSize] = read7bitInt(buffer, offset + 1)
  const str = buffer.toString('utf8', offset + 1 + lenSize, offset + 1 + lenSize + byteLen)
  return [str, 1 + lenSize + byteLen]
}

/**
 * Parses an osu!stable collection.db binary buffer.
 * @returns Array of parsed collection entries, or an object with version and entries if `options.includeVersion` is true.
 * @example
 * const entries = readLegacyCollectionDb(readFileSync('collection.db'))
 * const { version, entries } = readLegacyCollectionDb(buf, { includeVersion: true })
 */
export function readLegacyCollectionDb(buffer: Buffer): LegacyCollectionEntry[]
export function readLegacyCollectionDb(buffer: Buffer, options: ReadLegacyCollectionOptions & { includeVersion: true }): { version: number; entries: LegacyCollectionEntry[] }
export function readLegacyCollectionDb(buffer: Buffer, options?: ReadLegacyCollectionOptions): LegacyCollectionEntry[] | { version: number; entries: LegacyCollectionEntry[] } {
  let offset = 0
  const version = buffer.readInt32LE(offset); offset += 4
  const count = buffer.readInt32LE(offset); offset += 4

  const result: LegacyCollectionEntry[] = []
  for (let i = 0; i < count; i++) {
    const [name, nameSize] = readLegacyString(buffer, offset)
    offset += nameSize

    const beatmapCount = buffer.readInt32LE(offset); offset += 4

    const beatmapMD5s: string[] = []
    for (let j = 0; j < beatmapCount; j++) {
      const [md5, md5Size] = readLegacyString(buffer, offset)
      offset += md5Size
      if (md5 !== null) beatmapMD5s.push(md5)
    }

    result.push({ name: name ?? '', beatmapMD5s })
  }

  return options?.includeVersion ? { version, entries: result } : result
}

/**
 * Serializes collection entries to the legacy osu!stable binary format.
 * @returns Buffer containing the binary collection.db data.
 * @example
 * writeLegacyCollectionDb([{ name: 'Favs', beatmapMD5s: ['abc...'] }])
 */
export function writeLegacyCollectionDb(entries: LegacyCollectionEntry[]): Buffer {
  let size = 8
  for (const entry of entries) {
    size += legacyStringSize(entry.name) + 4
    for (const md5 of entry.beatmapMD5s)
      size += legacyStringSize(md5)
  }

  const buf = Buffer.alloc(size)
  let offset = 0
  buf.writeInt32LE(LEGACY_VERSION, offset); offset += 4
  buf.writeInt32LE(entries.length, offset); offset += 4

  for (const entry of entries) {
    offset += writeLegacyString(buf, offset, entry.name)
    buf.writeInt32LE(entry.beatmapMD5s.length, offset); offset += 4
    for (const md5 of entry.beatmapMD5s)
      offset += writeLegacyString(buf, offset, md5)
  }

  return buf
}
