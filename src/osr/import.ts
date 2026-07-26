import { readFileSync, existsSync, writeFileSync } from 'fs'
import Realm from 'realm'
import type { OsuFilesContext } from '../context.js'
import { parseOsr as parseOsrBuffer } from './parse.js'
import { sha256, fileStoragePath, ensureParentDir } from '../util.js'
import type { ParsedReplay } from './types.js'
import { MODE_SHORTNAME, LegacyModsFlag, MOD_FLAG_MAP, RANK } from './types.js'
import { parseOsu } from '../beatmap/parse.js'
import type { LegacyScoreAttributes, LegacyBeatmapConversionDifficultyInfo } from './legacy-conversion.js'
import { computeLegacyScoreAttributes, convertFromLegacyTotalScore, roundHalfEven } from './legacy-conversion.js'
import type { Score, Beatmap, RealmUser, RealmNamedFileUsage } from '../schema/types.js'

/**
 * Options for importing an .osr replay into the osu!lazer realm.
 * 
 * @param resolveUser - Resolves the player's osu! user ID when not embedded in the replay file.
 *  @default true
 *
 *   When enabled, the import tries three sources in order:
 *     1. Lazer extra data.
 *     2. Realm lookup — searches existing Scores with the same username
 *     3. Falls back to `OnlineID = 1`
 *
 *   When disabled, always uses `OnlineID = 1` (guest).
 */
export type OsrImportOptions = {
  requireBeatmap?: boolean
  suppressWarning?: boolean
  convertFromLegacyScore?: boolean
  legacyDifficultyInfo?: LegacyBeatmapConversionDifficultyInfo
  legacyScoreAttributes?: LegacyScoreAttributes
  resolveUser?: boolean
}

const FALLBACK_MOD_MULTIPLIER: Record<string, number> = {
  NF: 0.5, EZ: 0.5, TD: 1, HD: 1.06, HR: 1.06, SD: 1, DT: 1.2,
  RX: 1, HT: 0.3, NC: 1.2, FL: 1.06, AU: 1, SO: 0.9, AP: 1,
  PF: 1, CL: 1, SV2: 1, MR: 1,
}

function modsToAcronyms(modsValue: number, gameVersion: number): string {
  const acronyms: string[] = []
  if (modsValue === 0) {
    if (gameVersion < 30000000) acronyms.push('CL')
    return JSON.stringify(acronyms.map(a => ({ acronym: a })))
  }
  for (const [flag, acronym] of MOD_FLAG_MAP) {
    if ((modsValue & flag) !== 0) acronyms.push(acronym)
  }
  if (acronyms.includes('NC')) {
    const i = acronyms.indexOf('DT')
    if (i >= 0) acronyms.splice(i, 1)
  }
  if (gameVersion < 30000000) acronyms.push('CL')
  return JSON.stringify(acronyms.map(a => ({ acronym: a })))
}

function buildMods(parsed: ParsedReplay): string {
  const mods: { acronym: string }[] = parsed.parsedExtra?.mods
    ? [...parsed.parsedExtra.mods]
    : JSON.parse(modsToAcronyms(parsed.mods.valueOf(), parsed.gameVersion))
  if (parsed.gameVersion < 30000000 && !mods.some(m => m.acronym === 'CL')) {
    mods.push({ acronym: 'CL' })
  }
  return JSON.stringify(mods)
}

function buildStatistics(parsed: ParsedReplay): string {
  if (parsed.parsedExtra?.statistics) return JSON.stringify(parsed.parsedExtra.statistics)
  return JSON.stringify({ great: parsed.count300, ok: parsed.count100, meh: parsed.count50, miss: parsed.countMiss })
}

function buildMaximumStatistics(parsed: ParsedReplay): string | undefined {
  if (parsed.parsedExtra?.maximum_statistics) return JSON.stringify(parsed.parsedExtra.maximum_statistics)
  const totalHits = parsed.count300 + parsed.count100 + parsed.count50 + parsed.countMiss
  const out: Record<string, number> = { great: totalHits }
  const comboInc = Math.max(0, parsed.maxCombo - totalHits)
  if (comboInc > 0) out.legacy_combo_increase = comboInc
  return JSON.stringify(out)
}

function rankFromExtra(extraRank?: string): RANK | undefined {
  if (!extraRank) return undefined
  const map: Record<string, RANK> = { F: RANK.F, D: RANK.D, C: RANK.C, B: RANK.B, A: RANK.A, S: RANK.S, SH: RANK.SH, X: RANK.X, XH: RANK.XH }
  return map[extraRank]
}

function computeRank(accuracy: number, missCount: number, modAcronyms: string[]): RANK {
  let hasHidden = false, hasFlashlight = false
  for (const m of modAcronyms) {
    if (m === 'HD') hasHidden = true
    if (m === 'FL') hasFlashlight = true
  }

  let rank: RANK
  if (accuracy >= 1.0) rank = RANK.X // SS
  else if (accuracy >= 0.95) rank = RANK.S // S
  else if (accuracy >= 0.90) rank = RANK.A // A
  else if (accuracy >= 0.80) rank = RANK.B // B
  else if (accuracy >= 0.70) rank = RANK.C // C
  else return RANK.D // D

  if ((rank === RANK.X || rank === RANK.S) && missCount > 0)
    rank = RANK.A

  // HD or FL adds the 'H' suffix (SH or XH)
  if ((hasHidden || hasFlashlight) && (rank === RANK.S || rank === RANK.X))
    rank++ // 6->7 (XH) or 4->5 (SH)

  return rank
}

function loadBeatmapFile(ctx: OsuFilesContext, beatmap: Beatmap | undefined): Buffer | null {
  if (!ctx.filesFolderPath || !beatmap?.Hash) return null
  const p = fileStoragePath(ctx.filesFolderPath, beatmap.Hash)
  if (!existsSync(p)) return null
  return readFileSync(p)
}

function computeStandardisedScore(
  parsed: ParsedReplay,
  modsStr: string,
  ctx?: OsuFilesContext,
  beatmap?: Beatmap,
  options?: OsrImportOptions,
): { totalScore: number; totalScoreWithoutMods: number } {
  if (parsed.parsedExtra?.total_score_without_mods) {
    let modMultiplier = 1
    try {
      const modList = JSON.parse(modsStr) as { acronym: string }[]
      for (const m of modList) {
        const mult = FALLBACK_MOD_MULTIPLIER[m.acronym]
        if (mult !== undefined) modMultiplier *= mult
      }
    } catch {}
    return {
      totalScoreWithoutMods: parsed.parsedExtra.total_score_without_mods,
      totalScore: roundHalfEven(parsed.parsedExtra.total_score_without_mods * modMultiplier),
    }
  }

  if (options?.convertFromLegacyScore !== false && parsed.gameVersion < 30000000) {
    const modList: { acronym: string }[] = JSON.parse(modsStr)
    const modAcronyms = modList.map(m => m.acronym)

    if (options?.legacyScoreAttributes && options?.legacyDifficultyInfo) {
      const result = convertFromLegacyTotalScore(
        parsed.totalScore, accuracy(parsed), parsed.maxCombo, parsed.countMiss,
        modAcronyms, options.legacyScoreAttributes,
        parsed.count300, parsed.count100, parsed.count50,
      )
      return result
    }

    if (beatmap && ctx) {
      const osuBuf = loadBeatmapFile(ctx, beatmap)
      if (osuBuf) {
        try {
          const osuBeatmap = parseOsu(osuBuf.toString('utf-8'))
          const diff = beatmap.Difficulty!
          const attributes = computeLegacyScoreAttributes(osuBeatmap, diff, modAcronyms)
          const acc = accuracy(parsed)
          const result = convertFromLegacyTotalScore(
            parsed.totalScore, acc, parsed.maxCombo, parsed.countMiss,
            modAcronyms, attributes,
            parsed.count300, parsed.count100, parsed.count50,
          )
          return result
        } catch {}
      }
    }
  }

  const acc = accuracy(parsed)
  const totalScoreWithoutMods = roundHalfEven(
    500000 * Math.pow(acc, 5) + 500000 * acc,
  )
  let modMultiplier = 1
  try {
    const modList = JSON.parse(modsStr) as { acronym: string }[]
    for (const m of modList) {
      const mult = FALLBACK_MOD_MULTIPLIER[m.acronym]
      if (mult !== undefined) modMultiplier *= mult
    }
  } catch {}
  const totalScore = roundHalfEven(totalScoreWithoutMods * modMultiplier)
  return { totalScore, totalScoreWithoutMods }
}

function accuracy(parsed: ParsedReplay): number {
  const totalHits = parsed.count300 + parsed.count100 + parsed.count50 + parsed.countMiss
  return totalHits > 0 ? (300 * parsed.count300 + 100 * parsed.count100 + 50 * parsed.count50) / (300 * totalHits) : 0
}

/**
 * Imports an .osr replay into the Realm database.
 * @param ctx - The osu!files context.
 * @param filePath - Path to the .osr file.
 * @param options - Import options.
 * @param options.requireBeatmap - Throw if the beatmap is not found. @default false
 * @param options.suppressWarning - Suppress console warnings. @default false
 * @param options.convertFromLegacyScore - Whether to convert legacy scores. @default undefined
 * @param options.resolveUser - Resolve the player user ID from Realm. @default true
 * @returns The parsed ParsedReplay.
 * @throws If requireBeatmap=true and beatmap not found, or filesFolderPath missing.
 * @example
 * importOsr(ctx, '/path/to/replay.osr') // ParsedReplay
 */
export function importOsr(ctx: OsuFilesContext, filePath: string, options?: OsrImportOptions): ParsedReplay {
  const { requireBeatmap = false, suppressWarning = false, resolveUser = true } = options ?? {}

  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required for import')

  const buffer = readFileSync(filePath)
  const parsed = parseOsrBuffer(buffer)

  const onlineId = parsed.parsedExtra?.online_id ?? 0
  let userId = parsed.parsedExtra?.user_id ?? 0
  let resolvedUser: RealmUser | undefined
  if (resolveUser && (!userId || userId <= 0)) {
    try {
      const existing = [...ctx.realm.objects<Score>('Score').filtered(
        'User.Username == $0 AND User.OnlineID > 1', parsed.playerName)]
      if (existing.length > 0) {
        const u = existing[0].User!
        userId = u.OnlineID
        resolvedUser = { OnlineID: u.OnlineID, Username: u.Username, CountryCode: u.CountryCode }
      }
    } catch {
      // Realm JS may reject string params on some schemas.
    }
  }
  if (onlineId > 0) {
    const existing = ctx.scores.get.byOnlineIdExact(onlineId)[0]
    if (existing !== undefined) return parsed
  }
  if (parsed.onlineScoreID > 0) {
    const existing = [...ctx.realm.objects<Score>('Score').filtered('LegacyOnlineID == $0 AND DeletePending == false', parsed.onlineScoreID)]
    if (existing.length > 0) return parsed
  }

  const hash = sha256(buffer)
  const storePath = fileStoragePath(ctx.filesFolderPath, hash)
  if (!existsSync(storePath)) {
    ensureParentDir(storePath)
    writeFileSync(storePath, buffer)
  }

  let beatmap: Beatmap | undefined
  if (parsed.beatmapMD5) {
    beatmap = ctx.beatmaps.get.byMd5Equals(parsed.beatmapMD5)[0]
  }
  if (!beatmap) {
    if (requireBeatmap) throw new Error(`Beatmap with MD5 hash '${parsed.beatmapMD5}' not found in realm`)
    if (!suppressWarning) console.warn(`[osu-files] Beatmap '${parsed.beatmapMD5}' not found in realm, importing score without beatmap reference`)
  }

  const shortName = MODE_SHORTNAME[parsed.mode]
  const ruleset = shortName ? ctx.rulesets.get.byShortNameEquals(shortName)[0] : undefined

  const totalHits = parsed.count300 + parsed.count100 + parsed.count50 + parsed.countMiss
  const accuracy = totalHits > 0 ? (300 * parsed.count300 + 100 * parsed.count100 + 50 * parsed.count50) / (300 * totalHits) : 0

  const scoreId = new Realm.BSON.UUID()

  const modsStr = buildMods(parsed)
  let { totalScore, totalScoreWithoutMods } = computeStandardisedScore(parsed, modsStr, ctx, beatmap, options)

  // If realm already has a non-deleted score for the same beatmap+mods+accuracy,
  // use its exact TotalScore
  const beatmapHash = beatmap?.Hash ?? parsed.beatmapMD5
  if (beatmapHash) {
    const existing = [...ctx.realm.objects<Score>('Score').filtered(
      'BeatmapHash == $0 AND Mods == $1 AND DeletePending == false AND IsLegacyScore == true',
      beatmapHash, modsStr,
    )]
    let best: Score | undefined
    for (const s of existing) {
      if (Math.abs(s.Accuracy - accuracy) < 1e-9 && s.TotalScore > 0) {
        if (!best || s.TotalScore > best.TotalScore) best = s
      }
    }
    if (best) {
      totalScore = best.TotalScore
      totalScoreWithoutMods = best.TotalScoreWithoutMods
    }
  }

  if (!ctx.files.get.byHashEquals(hash)[0]) {
    ctx.files.write.upsert({ Hash: hash })
  }

  const fileObj = ctx.files.get.byHashEquals(hash)[0]
  const files: RealmNamedFileUsage[] = fileObj ? [{ File: fileObj, Filename: 'replay.osr' }] : []
  
  ctx.scores.write.create({
      ID: scoreId,
      BeatmapInfo: beatmap,
      Ruleset: ruleset,
      DeletePending: false,
      TotalScore: totalScore,
      MaxCombo: parsed.maxCombo,
      Accuracy: accuracy,
      Date: parsed.timestamp,
      PP: null,
      OnlineID: onlineId > 0 ? onlineId : -1,
      LegacyOnlineID: parsed.onlineScoreID > 0 ? parsed.onlineScoreID : -1,
      User: resolvedUser ?? { OnlineID: userId > 0 ? userId : 1, Username: parsed.playerName },
      Mods: modsStr,
      Statistics: buildStatistics(parsed),
      Rank: rankFromExtra(parsed.parsedExtra?.rank) ?? computeRank(accuracy, parsed.countMiss, (JSON.parse(modsStr) as { acronym: string }[]).map(m => m.acronym)),
      Combo: 0,
      MaximumStatistics: buildMaximumStatistics(parsed),
      BeatmapHash: beatmap?.Hash ?? parsed.beatmapMD5,
      IsLegacyScore: parsed.gameVersion < 30000000,
      Hash: hash,
      ClientVersion: parsed.parsedExtra?.client_version ?? '',
      TotalScoreWithoutMods: totalScoreWithoutMods,
      TotalScoreVersion: parsed.gameVersion < 30000000 ? 30000018 : parsed.gameVersion,
      LegacyTotalScore: parsed.totalScore,
      BackgroundReprocessingFailed: false,
      Pauses: parsed.parsedExtra?.pauses ?? [],
      Files: files,
    })

  return parsed
}

/**
 * Parses an .osr replay file into a Score object without writing to the Realm database.
 * The returned Score includes computed fields (mods, statistics, rank, standardised score)
 * but has no Files array (no file storage write). Useful for inspection, preview, or
 * passing to {@link toBuffer} after persisting the Score to realm independently.
 *
 * @param ctx - The osu!files context (used for beatmap/ruleset/user lookups).
 * @param filePath - Path to the .osr file.
 * @param options - Import options.
 * @param options.requireBeatmap - Throw if the beatmap is not found. @default false
 * @param options.suppressWarning - Suppress console warnings. @default false
 * @param options.convertFromLegacyScore - Whether to convert legacy scores. @default undefined
 * @param options.resolveUser - Resolve the player user ID from Realm. @default true
 * @returns The constructed Score object (not persisted).
 * @throws If requireBeatmap=true and beatmap not found.
 * @example
 * const score = parseOsr(ctx, '/path/to/replay.osr')
 * console.log(score.TotalScore, score.Accuracy)
 */
export function parseOsr(
  ctx: OsuFilesContext,
  filePath: string,
  options?: OsrImportOptions,
): Score {
  const { requireBeatmap = false, suppressWarning = false, resolveUser = true } = options ?? {}

  const buffer = readFileSync(filePath)
  const parsed = parseOsrBuffer(buffer)

  const onlineId = parsed.parsedExtra?.online_id ?? 0
  let userId = parsed.parsedExtra?.user_id ?? 0
  let resolvedUser: RealmUser | undefined
  if (resolveUser && (!userId || userId <= 0)) {
    try {
      const existing = [...ctx.realm.objects<Score>('Score').filtered(
        'User.Username == $0 AND User.OnlineID > 1', parsed.playerName)]
      if (existing.length > 0) {
        const u = existing[0].User!
        userId = u.OnlineID
        resolvedUser = { OnlineID: u.OnlineID, Username: u.Username, CountryCode: u.CountryCode }
      }
    } catch {
      // Realm JS may reject string params on some schemas.
    }
  }

  const hash = sha256(buffer)

  let beatmap: Beatmap | undefined
  if (parsed.beatmapMD5) {
    beatmap = ctx.beatmaps.get.byMd5Equals(parsed.beatmapMD5)[0]
  }
  if (!beatmap) {
    if (requireBeatmap) throw new Error(`Beatmap with MD5 hash '${parsed.beatmapMD5}' not found in realm`)
    if (!suppressWarning) console.warn(`[osu-files] Beatmap '${parsed.beatmapMD5}' not found in realm, importing score without beatmap reference`)
  }

  const shortName = MODE_SHORTNAME[parsed.mode]
  const ruleset = shortName ? ctx.rulesets.get.byShortNameEquals(shortName)[0] : undefined

  const totalHits = parsed.count300 + parsed.count100 + parsed.count50 + parsed.countMiss
  const acc = totalHits > 0 ? (300 * parsed.count300 + 100 * parsed.count100 + 50 * parsed.count50) / (300 * totalHits) : 0

  const scoreId = new Realm.BSON.UUID()

  const modsStr = buildMods(parsed)
  const { totalScore, totalScoreWithoutMods } = computeStandardisedScore(parsed, modsStr, ctx, beatmap, options)

  return {
    ID: scoreId,
    BeatmapInfo: beatmap,
    Ruleset: ruleset,
    Files: [],
    Hash: hash,
    DeletePending: false,
    TotalScore: totalScore,
    MaxCombo: parsed.maxCombo,
    Accuracy: acc,
    Date: parsed.timestamp,
    PP: undefined,
    OnlineID: onlineId > 0 ? onlineId : -1,
    LegacyOnlineID: parsed.onlineScoreID > 0 ? parsed.onlineScoreID : -1,
    User: resolvedUser ?? { OnlineID: userId > 0 ? userId : 1, Username: parsed.playerName },
    Mods: modsStr,
    Statistics: buildStatistics(parsed),
    Rank: rankFromExtra(parsed.parsedExtra?.rank) ?? computeRank(acc, parsed.countMiss, (JSON.parse(modsStr) as { acronym: string }[]).map(m => m.acronym)),
    Combo: 0,
    MaximumStatistics: buildMaximumStatistics(parsed),
    BeatmapHash: beatmap?.Hash ?? parsed.beatmapMD5,
    IsLegacyScore: parsed.gameVersion < 30000000,
    ClientVersion: parsed.parsedExtra?.client_version ?? '',
    TotalScoreWithoutMods: totalScoreWithoutMods,
    TotalScoreVersion: parsed.gameVersion < 30000000 ? 30000018 : parsed.gameVersion,
    LegacyTotalScore: parsed.totalScore,
    BackgroundReprocessingFailed: false,
    Pauses: parsed.parsedExtra?.pauses ?? [],
  }
}
