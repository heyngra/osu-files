import { readFileSync } from 'fs'
import type { OsuFilesContext } from '../context.js'
import type { Score } from '../schema/types.js'
import { fileStoragePath } from '../util.js'
import { writeFileAtomic } from '../util.js'
import { dateToTicks, writeString, parseOsr, computeReplayMD5 } from './parse.js'
import { SHORTNAME_TO_MODE, MOD_ACRONYM_TO_FLAG } from './types.js'
import { validateOwnerHashes } from '../integrity.js'

function parseMods(modsStr: string | undefined | null): number {
  if (!modsStr) return 0
  const trimmed = modsStr.trim()
  if (!trimmed) return 0
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10) || 0
  try {
    const arr = JSON.parse(trimmed)
    if (!Array.isArray(arr)) return 0
    let bits = 0
    for (const item of arr) {
      const acr = typeof item === 'string' ? item : item?.acronym
      if (acr && MOD_ACRONYM_TO_FLAG[acr]) bits |= MOD_ACRONYM_TO_FLAG[acr]
    }
    if (bits & 512) bits |= 64
    return bits
  } catch {
    return 0
  }
}

enum StatKey {
  count300 = 'count300',
  count100 = 'count100',
  count50 = 'count50',
  countGeki = 'countGeki',
  countKatu = 'countKatu',
  countMiss = 'countMiss',
}

const STAT_KEY_MAP: Record<string, StatKey> = {
  n300: StatKey.count300, great: StatKey.count300, Great: StatKey.count300, count300: StatKey.count300,
  n100: StatKey.count100, ok: StatKey.count100, Ok: StatKey.count100, count100: StatKey.count100,
  n50: StatKey.count50, meh: StatKey.count50, Meh: StatKey.count50, count50: StatKey.count50,
  nGeki: StatKey.countGeki, geki: StatKey.countGeki, countGeki: StatKey.countGeki,
  nKatu: StatKey.countKatu, katu: StatKey.countKatu, countKatu: StatKey.countKatu,
  nMiss: StatKey.countMiss, miss: StatKey.countMiss, Miss: StatKey.countMiss, countMiss: StatKey.countMiss,
}
/**
 * Exports a score to an .osr replay file on disk.
 * @throws If score not found or replay file missing.
 * @example
 * exportOsr(ctx, scoreId, './replay.osr')
 */
export function exportOsr(ctx: OsuFilesContext, scoreId: string, outputPath: string): void { // TODO: add exporting via Score object
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required for export')

  const score = ctx.scores.get.byId(scoreId)[0]
  if (!score) throw new Error(`Score '${scoreId}' not found`)
  validateOwnerHashes(ctx, score as never)

  writeFileAtomic(outputPath, toBuffer(ctx, score as never))
}

/**
 * Serialises a Score into an .osr replay buffer without writing to disk.
 * The score must have its `Files` array populated with a `replay.osr` entry
 * (i.e. it must have been persisted to realm and retrieved from there).
 * @throws If filesFolderPath is missing or replay file not found on score.
 * @example
 * const buf = toBuffer(ctx, score)
 * writeFileSync('./out.osr', buf)
 */
export function toBuffer(ctx: OsuFilesContext, score: Score): Buffer {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required')

  const replayFile = score.Files?.find(f => f.Filename === 'replay.osr' || f.Filename === 'replay')
  if (!replayFile?.File?.Hash) throw new Error('Replay file not found for score')

  let rawReplayData: Buffer = readFileSync(fileStoragePath(ctx.filesFolderPath, replayFile.File.Hash))

  let parsedTicks: bigint | null = null
  let parsedExtra: Buffer | null = null
  let storedPerfectCombo: boolean | null = null
  const firstByte = rawReplayData[0]
  if (firstByte !== undefined && firstByte !== 0x5D) {
    try {
      const inner = parseOsr(rawReplayData)
      rawReplayData = inner.rawReplayData as Buffer
      parsedTicks = inner.timestampTicks
      parsedExtra = inner.rawExtraData
      storedPerfectCombo = inner.perfectCombo
    } catch {
    }
  }

  const buffers: Buffer[] = []

  const mode = score.Ruleset?.ShortName
    ? (SHORTNAME_TO_MODE[score.Ruleset.ShortName] ?? 0)
    : 0
  const modeByte = Buffer.alloc(1); modeByte.writeUInt8(mode); buffers.push(modeByte)

  const versionBuf = Buffer.alloc(4)
  versionBuf.writeInt32LE(score.TotalScoreVersion ?? 30000000, 0)
  buffers.push(versionBuf)

  writeString(buffers, score.BeatmapInfo?.MD5Hash ?? score.BeatmapHash ?? '')
  writeString(buffers, score.User?.Username ?? '')
  writeString(buffers, computeReplayMD5(score.User?.Username ?? '', score.Date instanceof Date ? score.Date : new Date(score.Date)))

  const stat = parseStatistics(score.Statistics)

  const u16 = (v: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(v, 0); return b }
  const i32 = (v: number) => { const b = Buffer.alloc(4); b.writeInt32LE(v, 0); return b }
  const i64 = (v: bigint) => { const b = Buffer.alloc(8); b.writeBigInt64LE(v, 0); return b }

  buffers.push(u16(stat.count300 ?? 0))
  buffers.push(u16(stat.count100 ?? 0))
  buffers.push(u16(stat.count50 ?? 0))
  buffers.push(u16(stat.countGeki ?? 0))
  buffers.push(u16(stat.countKatu ?? 0))
  buffers.push(u16(stat.countMiss ?? 0))

  buffers.push(i32(score.TotalScore ?? 0))
  buffers.push(u16(score.MaxCombo ?? 0))

  const perfectBuf = Buffer.alloc(1)
  if (storedPerfectCombo !== null) {
    perfectBuf.writeUInt8(storedPerfectCombo ? 1 : 0)
  } else {
    perfectBuf.writeUInt8(score.Combo != null && score.MaxCombo != null && score.Combo === score.MaxCombo ? 1 : 0)
  }
  buffers.push(perfectBuf)

  const mods = parseMods(score.Mods)
  buffers.push(i32(mods))

  writeString(buffers, '')

  const date = score.Date instanceof Date ? score.Date : new Date(score.Date)
  const maxStat = score.MaximumStatistics as string | undefined | null
  const storedTicks = maxStat && /^\d+$/.test(maxStat) ? BigInt(maxStat) : null
  buffers.push(i64(parsedTicks ?? storedTicks ?? dateToTicks(date)))

  buffers.push(i32(rawReplayData.length))
  buffers.push(rawReplayData)

  buffers.push(i64(BigInt(score.LegacyOnlineID ?? score.OnlineID ?? -1)))

  const extraFile = score.Files?.find(f => f.Filename === 'replay.extra')
  const extraBytes = extraFile?.File?.Hash
    ? readFileSync(fileStoragePath(ctx.filesFolderPath, extraFile.File.Hash))
    : parsedExtra
  if (extraBytes) {
    const extLen = Buffer.alloc(4)
    extLen.writeInt32LE(extraBytes.length, 0)
    buffers.push(extLen)
    buffers.push(extraBytes)
  }

  return Buffer.concat(buffers)
}

function parseStatistics(statStr: string | undefined | null): Record<string, number> {
  if (!statStr) return {}
  try {
    const raw = JSON.parse(statStr) as Record<string, number>
    const out: Record<string, number> = {}
    for (const [key, val] of Object.entries(raw)) {
      const mapped = STAT_KEY_MAP[key]
      if (mapped) out[mapped] = (out[mapped] ?? 0) + val
    }
    return out
  } catch {
    return {}
  }
}
