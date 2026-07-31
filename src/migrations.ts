import { existsSync, readFileSync } from 'fs'
import Realm from 'realm'
import { readLegacyCollectionDb } from './collections/legacy.js'
import { fileStoragePath } from './util.js'
import { parseOsr as parseReplay } from './osr/parse.js'
import { roundHalfEven } from './osr/legacy-conversion.js'
import { CURRENT_SCHEMA_VERSION, MIN_SCHEMA_VERSION } from './schema/version.js'

type MigrationFileUsage = { Filename?: string; File?: { Hash?: string } }
type MigrationRecord = {
  [key: string]: unknown
  OnlineID?: number | null; Action?: number; KeyCombination?: string | null
  RulesetName?: string | null; Variant?: number | null; Protected?: boolean
  StarRating?: number; UserSettings?: object | null; BeatmapInfo?: MigrationRecord | null
  Hash?: string | null; Files?: Iterable<MigrationFileUsage>; Ruleset?: MigrationRecord | null
  RulesetID?: unknown; Author?: string | MigrationRecord | null; IsLegacyScore?: boolean
  TotalScoreVersion?: number; TotalScore?: number; LegacyTotalScore?: number
  Mods?: string | null; TotalScoreWithoutMods?: number; LegacyOnlineID?: number
  Status?: number; LastOnlineUpdate?: Date | null; OnlineMD5Hash?: string
  BeatmapHash?: string; ClientVersion?: string; Date?: Date
}

/** A single event emitted while migrating a Realm. */
export type MigrationEvent = {
  version: number
  name: string
  message: string
  level: 'info' | 'warning'
  durationMs?: number
}

/** Options and results available to migration handlers. */
export type MigrationContext = {
  filesFolderPath?: string
  legacyCollectionPath?: string
  events: MigrationEvent[]
  onEvent?: (event: MigrationEvent) => void
}

/** A migration result returned by {@link runMigrations}. */
export type MigrationReport = {
  fromVersion: number
  toVersion: number
  events: MigrationEvent[]
}

type Step = {
  version: number
  name: string
  run: (oldRealm: Realm, newRealm: Realm, context: MigrationContext) => void
}

const steps = new Map<number, Step>()

for (let version = MIN_SCHEMA_VERSION + 1; version <= CURRENT_SCHEMA_VERSION; version++)
  steps.set(version, { version, name: `Schema version ${version}`, run: () => {} })

steps.set(7, step(7, 'Normalize online IDs', (_old, realm) => {
  for (const type of ['Beatmap', 'BeatmapSet', 'Ruleset'])
    for (const object of realm.objects<MigrationRecord>(type))
      if (object.OnlineID == null) object.OnlineID = -1
}))

steps.set(8, step(8, 'Remove obsolete scroll speed bindings', (_old, realm) => {
  for (const action of [14, 15]) {
    const binding = [...realm.objects<MigrationRecord>('KeyBinding')].find(object => object.Action === action)
    const key = action === 14 ? 'Control + Plus' : 'Control + Minus'
    if (binding && binding.KeyCombination === key) realm.delete(binding)
  }
}))

steps.set(9, step(9, 'Convert metadata authors', (oldRealm, realm, context) => {
  if (!hasSchema(oldRealm, 'BeatmapMetadata')) return
  migrateIndexed(oldRealm, realm, 'BeatmapMetadata', (oldObject, newObject) => {
    if (typeof oldObject.Author === 'string')
      newObject.Author = { OnlineID: 1, Username: oldObject.Author, CountryCode: 'Unknown' }
  }, context)
}))

steps.set(10, step(10, 'Convert ruleset setting links', (oldRealm, realm, context) => {
  if (!hasSchema(oldRealm, 'RulesetSetting')) return
  migrateIndexed(oldRealm, realm, 'RulesetSetting', (oldObject, newObject) => {
    const name = rulesetName(oldObject.RulesetID)
    if (!name) return false
    newObject.RulesetName = name
  }, context)
}))

steps.set(11, step(11, 'Convert keybinding links', (oldRealm, realm, context) => {
  if (!hasSchema(oldRealm, 'KeyBinding')) return
  migrateIndexed(oldRealm, realm, 'KeyBinding', (oldObject, newObject) => {
    if (oldObject.RulesetID == null) return
    const name = rulesetName(oldObject.RulesetID)
    if (!name) return false
    newObject.RulesetName = name
  }, context)
}))

steps.set(14, step(14, 'Create beatmap user settings', (_old, realm) => {
  for (const beatmap of realm.objects<MigrationRecord>('Beatmap'))
    if (!beatmap.UserSettings) beatmap.UserSettings = { Offset: 0 }
}))

steps.set(20, step(20, 'Reset star ratings', (_old, realm) => {
  for (const beatmap of realm.objects<MigrationRecord>('Beatmap')) beatmap.StarRating = -1
}))

steps.set(21, step(21, 'Import legacy collections', (_old, realm, context) => {
  const path = context.legacyCollectionPath
  if (!path || !existsSync(path)) return

  try {
    const entries = readLegacyCollectionDb(readFileSync(path))
    for (const entry of entries) {
      const existing = realm.objects<MigrationRecord>('BeatmapCollection').filtered('Name == $0', entry.name)[0]
      if (existing) {
        const hashes = existing.BeatmapMD5Hashes as string[]
        for (const hash of entry.beatmapMD5s)
          if (!hashes.includes(hash)) hashes.push(hash)
      } else {
        realm.create('BeatmapCollection', {
          ID: new Realm.BSON.UUID(),
          Name: entry.name,
          BeatmapMD5Hashes: entry.beatmapMD5s,
          LastModified: new Date(),
        })
      }
    }
    const event = { version: 21, name: 'Import legacy collections', message: `Imported ${entries.length} collections`, level: 'info' as const }
    context.events.push(event)
    context.onEvent?.(event)
  } catch (error) {
    warn(context, 21, 'Import legacy collections', `Could not read ${path}: ${String(error)}`)
    throw error
  }
}))

steps.set(25, step(25, 'Remove protected skins', (_old, realm) => {
  for (const skin of [...realm.objects<MigrationRecord>('Skin')].filter(s => s.Protected)) realm.delete(skin)
}))

steps.set(26, step(26, 'Backfill score beatmap hashes', (_old, realm) => {
  for (const score of realm.objects<MigrationRecord>('Score'))
    score.BeatmapHash = score.BeatmapInfo?.Hash ?? ''
}))

steps.set(28, step(28, 'Detect legacy scores', (_old, realm, context) => {
  for (const score of realm.objects<MigrationRecord>('Score')) {
    const replay = readScoreReplay(context, score)
    if (!replay) continue
    try { score.IsLegacyScore = replay.gameVersion < 30000000 } catch (error) {
      warn(context, 28, 'Detect legacy scores', `Could not parse score ${String(score.ID)}: ${String(error)}`)
    }
  }
}))

steps.set(31, step(31, 'Initialize score versions', (_old, realm) => {
  for (const score of realm.objects<MigrationRecord>('Score')) {
    if (score.IsLegacyScore && isLegacyRuleset(score.Ruleset)) {
      score.TotalScoreVersion = 30000002
      score.LegacyTotalScore = score.TotalScore
    } else {
      score.TotalScoreVersion = 30000003
    }
  }
}))

steps.set(32, step(32, 'Restore ScoreV2 legacy scores', (_old, realm, context) => {
  for (const score of realm.objects<MigrationRecord>('Score')) {
    if (!score.IsLegacyScore || !isLegacyRuleset(score.Ruleset)) continue
    const replay = readScoreReplay(context, score)
    if (!replay?.mods.scoreV2) continue
      const mods = parseModDetails(score.Mods) ?? []
     if (!mods.some(mod => mod.acronym === 'SV2')) mods.push({ acronym: 'SV2' })
     score.Mods = JSON.stringify(mods)
    score.TotalScore = replay.totalScore
    score.LegacyTotalScore = replay.totalScore
  }
}))

steps.set(33, step(33, 'Remove conflicting chat binding', (_old, realm) => {
  for (const binding of [...realm.objects<MigrationRecord>('KeyBinding')])
    if (binding.Action === 47 && binding.KeyCombination === 'Tab') realm.delete(binding)
}))

steps.set(35, step(35, 'Remove duplicate keybindings', (_old, realm) => {
  const keyBindings = [...realm.objects<MigrationRecord>('KeyBinding')]
  const catchDash = keyBindings.filter(binding =>
    binding.RulesetName === 'fruits' && binding.Action === 2,
  )
  if (catchDash.length > 0 && catchDash.every(binding => binding.KeyCombination === 'Shift'))
    catchDash.at(-1)!.KeyCombination = 'MouseLeft'

  const global = keyBindings.filter(binding => binding.RulesetName == null)
  for (const actions of GLOBAL_ACTION_CATEGORIES)
    clearDuplicateBindings(global.filter(binding => actions.has(binding.Action ?? -1)))

  const groups = new Map<string, MigrationRecord[]>()
  for (const binding of keyBindings.filter(binding => binding.RulesetName != null)) {
    const key = `${binding.RulesetName}:${binding.Variant ?? ''}`
    const group = groups.get(key)
    if (group) group.push(binding)
    else groups.set(key, [binding])
  }
  for (const group of groups.values()) clearDuplicateBindings(group)
}))

steps.set(36, step(36, 'Normalize score online IDs', (_old, realm) => {
  for (const score of realm.objects<MigrationRecord>('Score')) {
    const onlineId = score.OnlineID ?? -1
    if (onlineId > 0) {
      score.LegacyOnlineID = onlineId
      score.OnlineID = -1
    } else {
      score.LegacyOnlineID = -1
      score.OnlineID = -1
    }
  }
}))

steps.set(39, step(39, 'Reset unprocessed object counts', (_old, realm) => {
  for (const beatmap of realm.objects<MigrationRecord>('Beatmap')) {
    if (beatmap.TotalObjectCount === 0 && beatmap.EndTimeObjectCount === 0) {
      beatmap.TotalObjectCount = -1
      beatmap.EndTimeObjectCount = -1
    }
  }
}))

steps.set(41, step(41, 'Populate score values without mod multipliers', (_old, realm, context) => {
  for (const score of realm.objects<MigrationRecord>('Score')) {
    if ((score.TotalScoreWithoutMods ?? 0) > 0) continue
    const multiplier = scoreMultiplier(score)
    if (!multiplier || !Number.isFinite(multiplier) || multiplier <= 0) {
      warn(context, 41, 'Populate score values without mod multipliers', `Could not calculate score ${String(score.ID)}`)
      continue
    }
    score.TotalScoreWithoutMods = roundHalfEven((score.TotalScore ?? 0) / multiplier)
  }
}))

steps.set(42, step(42, 'Remap mania keybindings', (_old, realm) => {
  for (let columns = 1; columns <= 10; columns++) {
    remapManiaKeybindings(realm, columns, false)
    remapManiaKeybindings(realm, columns, true)
  }
}))

steps.set(43, step(43, 'Remove conflicting FPS binding', (_old, realm) => {
  removeBinding(realm, 58, 'Shift + Control + F')
}))

steps.set(45, step(45, 'Remove obsolete beat snap bindings', (_old, realm) => {
  removeBinding(realm, 62, 'Shift + Control + MouseWheelLeft')
  removeBinding(realm, 61, 'Shift + Control + MouseWheelRight')
}))

steps.set(46, step(46, 'Remove mismatched beat snap bindings', (_old, realm) => {
  removeBinding(realm, 62, 'Control + MouseWheelDown')
  removeBinding(realm, 61, 'Control + MouseWheelUp')
}))

steps.set(47, step(47, 'Remove obsolete absolute scroll binding', (_old, realm) => {
  removeBinding(realm, 88, 'MouseRight')
}))

steps.set(48, step(48, 'Reset qualified beatmaps', (_old, realm) => {
  for (const beatmap of realm.objects<MigrationRecord>('Beatmap')) {
    if (beatmap.Status === 3) {
      beatmap.LastOnlineUpdate = null
      beatmap.OnlineMD5Hash = ''
      beatmap.Status = -3
    }
  }
}))

steps.set(49, step(49, 'Normalize empty legacy score IDs', (_old, realm) => {
  for (const score of realm.objects<MigrationRecord>('Score'))
    if (score.LegacyOnlineID === 0) score.LegacyOnlineID = -1
}))

/** Runs all migrations required to reach the current schema version. */
export function runMigrations(oldRealm: Realm, newRealm: Realm, context: MigrationContext): MigrationReport {
  const fromVersion = oldRealm.schemaVersion
  const toVersion = newRealm.schemaVersion
  if (fromVersion < MIN_SCHEMA_VERSION)
    throw new Error(`[osu-files] Realm schema version ${fromVersion} is older than supported version ${MIN_SCHEMA_VERSION}`)
  if (toVersion > CURRENT_SCHEMA_VERSION)
    throw new Error(`[osu-files] Realm schema version ${toVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}`)

  for (let version = fromVersion + 1; version <= toVersion; version++) {
    const migration = steps.get(version)
    if (!migration) throw new Error(`[osu-files] Missing migration for Realm schema version ${version}`)
    const before = context.events.length
    const started = Date.now()
    migration.run(oldRealm, newRealm, context)
    if (context.events.length === before) {
      const event = { version, name: migration.name, message: 'Completed', level: 'info' as const, durationMs: Date.now() - started }
      context.events.push(event)
      context.onEvent?.(event)
    } else {
      for (let i = before; i < context.events.length; i++)
        context.events[i].durationMs ??= Date.now() - started
    }
  }

  return { fromVersion, toVersion, events: context.events }
}

function step(version: number, name: string, run: Step['run']): Step {
  return { version, name, run }
}

function warn(context: MigrationContext, version: number, name: string, message: string): void {
  const event = { version, name, message, level: 'warning' as const }
  context.events.push(event)
  context.onEvent?.(event)
}

function migrateIndexed(oldRealm: Realm, newRealm: Realm, type: string, migrate: (oldObject: MigrationRecord, newObject: MigrationRecord) => void | false, context: MigrationContext): void {
  const oldObjects = [...oldRealm.objects<MigrationRecord>(type)]
  const newObjects = [...newRealm.objects<MigrationRecord>(type)]
  for (let i = 0; i < Math.min(oldObjects.length, newObjects.length); i++) {
    if (migrate(oldObjects[i], newObjects[i]) === false) newRealm.delete(newObjects[i])
  }
  if (oldObjects.length !== newObjects.length)
    warn(context, 0, `Migrate ${type}`, `Object count changed from ${oldObjects.length} to ${newObjects.length}`)
}

function hasSchema(realm: Realm, type: string): boolean {
  return realm.schema.some(schema => schema.name === type)
}

function rulesetName(id: unknown): string | undefined {
  return ({ 0: 'osu', 1: 'taiko', 2: 'fruits', 3: 'mania' } as Record<number, string>)[Number(id)]
}

function removeBinding(realm: Realm, action: number, keyCombination: string): void {
  const binding = [...realm.objects<MigrationRecord>('KeyBinding')].find(object => object.Action === action && object.KeyCombination === keyCombination)
  if (binding) realm.delete(binding)
}

const GLOBAL_ACTION_CATEGORIES = [
  new Set([22, 23, 16, 13, 24, 58, 3, 42, 2, 32, 94, 95, 12, 11]),
  new Set([27, 28, 29, 30, 39, 60, 40, 41, 48, 83, 49, 57, 50, 51, 53, 52, 61, 62, 89, 67, 74, 79, 80, 81, 82, 84, 85, 86, 87, 90, 96, 97]),
  new Set([75, 76, 77, 78]),
  new Set([9, 10, 17, 14, 15, 34, 66, 26, 31, 47, 63, 64, 68, 69]),
  new Set([33, 98, 46, 45, 71, 70, 65]),
  new Set([54, 55, 91, 92, 93, 35, 36, 37, 38, 56, 72, 73, 88]),
  new Set([6, 7, 43, 44, 8, 19, 18, 20]),
  new Set([0, 21, 1, 5, 4, 25, 59]),
]

function clearDuplicateBindings(bindings: MigrationRecord[]): void {
  const byCombination = new Map<string, MigrationRecord[]>()
  for (const binding of bindings) {
    const group = byCombination.get(binding.KeyCombination ?? 'None')
    if (group) group.push(binding)
    else byCombination.set(binding.KeyCombination ?? 'None', [binding])
  }

  for (const group of byCombination.values()) {
    if (new Set(group.map(binding => binding.Action)).size > 1)
      for (const binding of group) binding.KeyCombination = 'None'
  }
}

function remapManiaKeybindings(realm: Realm, columns: number, dual: boolean): void {
  const variant = dual ? 1000 + columns * 2 : columns
  const bindings = [...realm.objects<MigrationRecord>('KeyBinding')]
    .filter(binding => binding.RulesetName === 'mania' && binding.Variant === variant)
    .map(binding => ({ Action: binding.Action, KeyCombination: binding.KeyCombination }))
  for (const binding of [...realm.objects<MigrationRecord>('KeyBinding')].filter(object => object.RulesetName === 'mania' && object.Variant === variant))
    realm.delete(binding)

  let oldNormalAction = 10
  let oldSpecialAction = 1
  for (let column = 0; column < columns * (dual ? 2 : 1); column++) {
    const oldAction = columns % 2 === 1 && column % columns === Math.floor(columns / 2)
      ? oldSpecialAction++
      : oldNormalAction++
    const oldBinding = bindings.find(binding => binding.Action === oldAction)
    if (oldBinding) realm.create('KeyBinding', {
      ID: new Realm.BSON.UUID(),
      RulesetName: 'mania',
      Variant: variant,
      Action: column,
      KeyCombination: oldBinding.KeyCombination,
    })
  }
}

function isLegacyRuleset(ruleset: MigrationRecord | null | undefined): boolean {
  return ruleset != null && Number(ruleset.OnlineID) >= 0 && Number(ruleset.OnlineID) <= 3
}

function readScoreReplay(context: MigrationContext, score: MigrationRecord): ReturnType<typeof parseReplay> | undefined {
  if (!context.filesFolderPath) return undefined
  const usage = [...(score.Files ?? [])].find(file => String(file.Filename ?? '').toLowerCase().endsWith('.osr'))
  const hash = usage?.File?.Hash
  if (!hash) return undefined
  try {
    return parseReplay(readFileSync(fileStoragePath(context.filesFolderPath, hash)))
  } catch {
    return undefined
  }
}

function scoreMultiplier(score: MigrationRecord): number | undefined {
  const ruleset = String(score.Ruleset?.ShortName ?? '')
  const mods = parseModDetails(score.Mods)
  if (!mods) return undefined
  const version = Number(score.TotalScoreVersion ?? 0)
  if (!['osu', 'taiko', 'fruits', 'mania'].includes(ruleset)) return undefined
  if (version >= 30000017) return undefined

  let result = 1
  for (const mod of mods) {
    const multiplier = multiplierFor(ruleset, mod.acronym, mod.settings, score)
    if (multiplier === undefined) return undefined
    result *= multiplier
  }
  return result
}

function multiplierFor(ruleset: string, mod: string, settings: Record<string, unknown> | undefined, score: MigrationRecord): number | undefined {
  const configured = hasSettings(settings)
  if (mod === 'NF' || mod === 'EZ') return 0.5
  if (mod === 'HT' || mod === 'DC') return rateAdjustMultiplier(numberSetting(settings, 'speed_change') ?? 0.75)
  if (mod === 'DT' || mod === 'NC') return rateAdjustMultiplier(numberSetting(settings, 'speed_change') ?? 1.5)
  if (mod === 'HD') return ruleset === 'mania' ? 1 : configured ? 1 : 1.06
  if (mod === 'HR') return ruleset === 'fruits' ? (configured ? 1 : 1.12) : ruleset === 'mania' ? 1 : configured ? 1 : 1.06
  if (mod === 'FL') return ruleset === 'mania' ? 1 : configured ? 1 : 1.12
  if (mod === 'BL') return ruleset === 'osu' ? (configured ? 1 : 1.12) : undefined
  if (mod === 'RX' || mod === 'AP') return 0.1
  if (mod === 'SO') return 0.9
  if (mod === 'WU' || mod === 'WD') return 0.5
  if (mod === 'AS') return 0.5
  if (mod === 'MG') return ruleset === 'osu' ? 0.5 : undefined
  if (mod === 'SY') return ruleset === 'osu' || ruleset === 'fruits' ? 0.8 : undefined
  if (mod === 'CL') return 0.96
  if (mod === 'TP') return 0.1
  if (mod === 'DA') return 0.5
  if (mod === 'SR') return ruleset === 'taiko' ? 0.6 : undefined
  if (mod === 'HO') return ruleset === 'mania' ? 0.9 : undefined
  if (ruleset === 'mania' && /^\d+K$/.test(mod)) return maniaKeyMultiplier(score)
  if (mod === 'NR') return ruleset === 'mania' ? 0.9 : undefined
  if (mod === 'CS') return ruleset === 'taiko' || ruleset === 'mania' ? 0.9 : undefined
  if (mod === 'SV2') return 1
  if (mod === 'SD' || mod === 'PF' || mod === 'TD' || mod === 'AU' || mod === 'CN' || mod === 'COOP') return 1
  if (mod === 'MR' || mod === 'RD' || mod === 'AT' || mod === 'NM') return 1
  if (mod === 'CO' || mod === 'FI' || mod === 'HD') return 1
  return undefined
}

function parseModDetails(value: unknown): Array<{ acronym: string; settings?: Record<string, unknown> }> | undefined {
  if (value === undefined || value === null || value === '') return []
  if (typeof value !== 'string') return undefined
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return undefined
    const mods: Array<{ acronym: string; settings?: Record<string, unknown> }> = []
    for (const item of parsed) {
      if (typeof item === 'string') {
        mods.push({ acronym: item })
        continue
      }
      if (!item || typeof item.acronym !== 'string') return undefined
      if (item.settings !== undefined && item.settings !== null &&
        (typeof item.settings !== 'object' || Array.isArray(item.settings))) return undefined
      mods.push({ acronym: item.acronym, settings: item.settings })
    }
    return mods
  } catch {
    return undefined
  }
}

function numberSetting(settings: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = settings?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function hasSettings(settings: Record<string, unknown> | undefined): boolean {
  return settings != null && Object.keys(settings).length > 0
}

function rateAdjustMultiplier(speedChange: number): number {
  const value = Math.floor(speedChange * 10) / 10 - 1
  return speedChange >= 1 ? 1 + value / 5 : 0.6 + value
}

function maniaKeyMultiplier(score: MigrationRecord): number {
  const clientVersion = String(score.ClientVersion ?? '')
  const pieces = clientVersion.split('.')
  if (pieces.length > 1) {
    const year = Number(pieces[0])
    const monthDay = Number(pieces[1])
    if (Number.isFinite(year) && Number.isFinite(monthDay))
      return year < 2025 || (year === 2025 && monthDay < 718) ? 1 : 0.9
  }

  const date = score.Date instanceof Date ? score.Date.getTime() : NaN
  return Number.isFinite(date) && date < Date.UTC(2025, 6, 18) ? 1 : 0.9
}
