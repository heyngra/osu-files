/** osu! game modes. */
export enum GameMode {
  Osu = 0,
  Taiko = 1,
  Fruits = 2,
  Mania = 3,
}
/** Rank values for a score. */
export enum RANK {
  X = 6,
  SS = 6,
  S = 4,
  A = 3,
  B = 2,
  C = 1,
  D = 0,
  SSH = 7,
  XH = 7,
  SH = 5,
  F = -1,
}
import { MODE_TO_SHORTNAME, SHORTNAME_TO_MODE as SHORTNAME_TO_MODE_CANON } from '../ruleset-info.js'

/** Maps GameMode to its short name (osu, taiko, fruits, mania). */
export const MODE_SHORTNAME: Record<GameMode, string> = MODE_TO_SHORTNAME as Record<GameMode, string>

/** Maps short name to GameMode value. */
export const SHORTNAME_TO_MODE: Record<string, number> = SHORTNAME_TO_MODE_CANON

/** Bit flags for legacy osu! mods. */
export enum LegacyModsFlag {
  None        = 0,
  NoFail      = 1 << 0,
  Easy        = 1 << 1,
  TouchDevice = 1 << 2,
  Hidden      = 1 << 3,
  HardRock    = 1 << 4,
  SuddenDeath = 1 << 5,
  DoubleTime  = 1 << 6,
  Relax       = 1 << 7,
  HalfTime    = 1 << 8,
  Nightcore   = 1 << 9,
  Flashlight  = 1 << 10,
  Autoplay    = 1 << 11,
  SpunOut     = 1 << 12,
  Autopilot   = 1 << 13,
  Perfect     = 1 << 14,
  Key4        = 1 << 15,
  Key5        = 1 << 16,
  Key6        = 1 << 17,
  Key7        = 1 << 18,
  Key8        = 1 << 19,
  FadeIn      = 1 << 20,
  Random      = 1 << 21,
  Cinema      = 1 << 22,
  Target      = 1 << 23,
  Key9        = 1 << 24,
  KeyCoop     = 1 << 25,
  Key1        = 1 << 26,
  Key3        = 1 << 27,
  Key2        = 1 << 28,
  ScoreV2     = 1 << 29,
  Mirror      = 1 << 30,
}

/** Maps LegacyModsFlag → mod acronym string. */
export const MOD_FLAG_MAP: [LegacyModsFlag, string][] = [
  [LegacyModsFlag.NoFail, 'NF'],
  [LegacyModsFlag.Easy, 'EZ'],
  [LegacyModsFlag.TouchDevice, 'TD'],
  [LegacyModsFlag.Hidden, 'HD'],
  [LegacyModsFlag.HardRock, 'HR'],
  [LegacyModsFlag.SuddenDeath, 'SD'],
  [LegacyModsFlag.DoubleTime, 'DT'],
  [LegacyModsFlag.Relax, 'RX'],
  [LegacyModsFlag.HalfTime, 'HT'],
  [LegacyModsFlag.Nightcore, 'NC'],
  [LegacyModsFlag.Flashlight, 'FL'],
  [LegacyModsFlag.Autoplay, 'AU'],
  [LegacyModsFlag.SpunOut, 'SO'],
  [LegacyModsFlag.Autopilot, 'AP'],
  [LegacyModsFlag.Perfect, 'PF'],
  [LegacyModsFlag.Key4, '4K'],
  [LegacyModsFlag.Key5, '5K'],
  [LegacyModsFlag.Key6, '6K'],
  [LegacyModsFlag.Key7, '7K'],
  [LegacyModsFlag.Key8, '8K'],
  [LegacyModsFlag.FadeIn, 'FI'],
  [LegacyModsFlag.Random, 'RD'],
  [LegacyModsFlag.Cinema, 'CN'],
  [LegacyModsFlag.Target, 'TP'],
  [LegacyModsFlag.Key9, '9K'],
  [LegacyModsFlag.KeyCoop, 'COOP'],
  [LegacyModsFlag.Key1, '1K'],
  [LegacyModsFlag.Key3, '3K'],
  [LegacyModsFlag.Key2, '2K'],
  [LegacyModsFlag.ScoreV2, 'SV2'],
  [LegacyModsFlag.Mirror, 'MR'],
]

/** Maps mod acronym string → LegacyModsFlag value. */
export const MOD_ACRONYM_TO_FLAG: Record<string, number> = Object.fromEntries(
  MOD_FLAG_MAP.map(([flag, acronym]) => [acronym, flag]),
)

/**
 * Wraps a legacy mods bitfield with type-safe getters.
 * @example
 * const mods = LegacyMods.from(72) // HD+DT
 * mods.hidden   // true
 * mods.doubleTime // true
 */
export class LegacyMods {
  private constructor(public readonly value: number) {}

  static from(value: number): LegacyMods {
    return new LegacyMods(value >>> 0)
  }

  valueOf(): number {
    return this.value
  }

  has(flag: LegacyModsFlag): boolean {
    return (this.value & flag) !== 0
  }

  get noFail(): boolean      { return this.has(LegacyModsFlag.NoFail) }
  get easy(): boolean        { return this.has(LegacyModsFlag.Easy) }
  get touchDevice(): boolean { return this.has(LegacyModsFlag.TouchDevice) }
  get hidden(): boolean      { return this.has(LegacyModsFlag.Hidden) }
  get hardRock(): boolean    { return this.has(LegacyModsFlag.HardRock) }
  get suddenDeath(): boolean { return this.has(LegacyModsFlag.SuddenDeath) }
  get doubleTime(): boolean  { return this.has(LegacyModsFlag.DoubleTime) }
  get relax(): boolean       { return this.has(LegacyModsFlag.Relax) }
  get halfTime(): boolean    { return this.has(LegacyModsFlag.HalfTime) }
  get nightcore(): boolean   { return this.has(LegacyModsFlag.Nightcore) }
  get flashlight(): boolean  { return this.has(LegacyModsFlag.Flashlight) }
  get autoplay(): boolean    { return this.has(LegacyModsFlag.Autoplay) }
  get spunOut(): boolean     { return this.has(LegacyModsFlag.SpunOut) }
  get autopilot(): boolean   { return this.has(LegacyModsFlag.Autopilot) }
  get perfect(): boolean     { return this.has(LegacyModsFlag.Perfect) }
  get scoreV2(): boolean     { return this.has(LegacyModsFlag.ScoreV2) }
  get mirror(): boolean      { return this.has(LegacyModsFlag.Mirror) }
  get target(): boolean      { return this.has(LegacyModsFlag.Target) }
  get cinema(): boolean      { return this.has(LegacyModsFlag.Cinema) }
  get fadeIn(): boolean      { return this.has(LegacyModsFlag.FadeIn) }
  get random(): boolean      { return this.has(LegacyModsFlag.Random) }
}

/** A single replay frame with cursor data. */
export type ReplayFrame = {
  /** @example 256 */
  timeDelta: number
  /** @example 100 */
  mouseX: number
  /** @example 150 */
  mouseY: number
  /** @example 0 */
  keys: number
}

/** A life bar frame (HP over time). */
export type LifeBarFrame = {
  /** @example 0 */
  time: number
  /** @example 1 */
  hp: number
}

/** Parsed LZMA extra data from a replay. */
export type ParsedExtra = {
  /** @example '20131110' */
  client_version?: string
  /** @example 'SH' */
  rank?: string
  /** @example 124493 */
  user_id?: number
  /** @example 1518856368 */
  online_id?: number
  /** @example 16638107 */
  total_score_without_mods?: number
  /** @example [{ acronym: 'HD' }, { acronym: 'DT' }] */
  mods?: { acronym: string; settings?: Record<string, unknown> }[]
  /** @example { count_300: 611, count_100: 8 } */
  statistics?: Record<string, number>
  /** @example { count_300: 611 } */
  maximum_statistics?: Record<string, number>
  /** @example [12345] */
  pauses?: number[]
}

/**
 * A fully parsed .osr replay.
 * @example
 * const replay = parseOsr(buffer)
 * console.log(replay.playerName, replay.replayFrames.length)
 */
export type ParsedReplay = {
  /** @example GameMode.Osu */
  mode: GameMode
  /** @example 20131110 */
  gameVersion: number
  /** @example 'e7532e42ab7aa3735fe3d109c675c140' */
  beatmapMD5: string
  /** @example 'Cookiezi' */
  playerName: string
  /** @example 'a1b2c3...' */
  replayMD5: string
  /** @example 611 */
  count300: number
  /** @example 8 */
  count100: number
  /** @example 0 */
  count50: number
  /** @example 107 */
  countGeki: number
  /** @example 6 */
  countKatu: number
  /** @example 0 */
  countMiss: number
  /** @example 16638107 */
  totalScore: number
  /** @example 871 */
  maxCombo: number
  /** @example true */
  perfectCombo: boolean
  /** @example LegacyMods.from(88) // HD+HR+DT */
  mods: LegacyMods
  /** @example [] */
  lifeBarGraph: LifeBarFrame[]
  /** @example new Date('2013-11-10T16:02:24Z') */
  timestamp: Date
  /** @example 635198977440000000n */
  timestampTicks: bigint
  /** @example 1518856368 */
  onlineScoreID: number
  /** @example 0 */
  additionalMods?: number
  /** @example Buffer.alloc(0) */
  rawReplayData: Buffer
  /** @example [] // 7247 frames in Cookiezi replay */
  replayFrames: ReplayFrame[]
  /** @example null */
  rawExtraData: Buffer | null
  /** @example null */
  parsedExtra: ParsedExtra | null
}
