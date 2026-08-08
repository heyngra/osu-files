export type FixtureRow = Record<string, unknown>

export type FixtureDatabaseData = {
  Beatmap: FixtureRow[]
  BeatmapSet: FixtureRow[]
  Score: FixtureRow[]
  BeatmapCollection: FixtureRow[]
  Ruleset: FixtureRow[]
  RulesetSetting: FixtureRow[]
  Skin: FixtureRow[]
  File: FixtureRow[]
  KeyBinding: FixtureRow[]
  ModPreset: FixtureRow[]
}

export type FixtureArgument = { code: string; value: unknown }
export type FixtureOperator = 'eq' | 'contains' | 'gte' | 'lte' | 'gt' | 'lt' | 'between' | 'any-eq'
export type FixtureMethodDescriptor = {
  path: string
  operator: FixtureOperator
  sample: FixtureArgument[]
}

const argument = (code: string, value: unknown = code): FixtureArgument => ({ code, value })
const dateArgument = (value = '2024-01-01') => argument(`new Date('${value}')`, new Date(`${value}T00:00:00.000Z`))
const uuidArgument = (value: string) => argument(`'${value}'`, value)
const hashArgument = (value = 'a') => argument(`'${value}'.repeat(64)`, value.repeat(64))
const md5Argument = () => argument("'b'.repeat(32)", 'b'.repeat(32))

export const FIXTURE_IDS = {
  beatmapSafe: '00000000-0000-4000-8000-000000000000',
  beatmapReferenced: '11111111-1111-4111-8111-111111111111',
  setSafe: '22222222-2222-4222-8222-222222222222',
  setReferenced: '33333333-3333-4333-8333-333333333333',
  scoreSafe: '44444444-4444-4444-8444-444444444444',
  scoreHigh: '55555555-5555-4555-8555-555555555555',
  collectionSafe: '66666666-6666-4666-8666-666666666666',
  collectionFavorites: '77777777-7777-4777-8777-777777777777',
  skinSafe: '88888888-8888-4888-8888-888888888888',
  skinWithFile: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  skinProtected: '99999999-9999-4999-8999-999999999999',
  skinPending: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  keybindingSafe: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  modPresetSafe: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  modPresetSecond: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
} as const

const eq = (path: string, ...args: FixtureArgument[]): FixtureMethodDescriptor => ({ path, operator: 'eq', sample: args })
const contains = (path: string, ...args: FixtureArgument[]): FixtureMethodDescriptor => ({ path, operator: 'contains', sample: args })
const gte = (path: string, ...args: FixtureArgument[]): FixtureMethodDescriptor => ({ path, operator: 'gte', sample: args })
const lte = (path: string, ...args: FixtureArgument[]): FixtureMethodDescriptor => ({ path, operator: 'lte', sample: args })
const gt = (path: string, ...args: FixtureArgument[]): FixtureMethodDescriptor => ({ path, operator: 'gt', sample: args })
const lt = (path: string, ...args: FixtureArgument[]): FixtureMethodDescriptor => ({ path, operator: 'lt', sample: args })
const between = (path: string, ...args: FixtureArgument[]): FixtureMethodDescriptor => ({ path, operator: 'between', sample: args })
const anyEq = (path: string, ...args: FixtureArgument[]): FixtureMethodDescriptor => ({ path, operator: 'any-eq', sample: args })
const noArguments = (): FixtureMethodDescriptor => ({ path: '', operator: 'eq', sample: [] })
const commonMethodDescriptors: Record<string, FixtureMethodDescriptor> = {
  all: noArguments(), toArray: noArguments(), first: noArguments(), count: noArguments(), limit: noArguments(), sortedBy: noArguments(),
  autoEdit: noArguments(), commit: noArguments(), rollback: noArguments(), 'write.delete': noArguments(), 'write.update': noArguments(),
}

const id = (value: string) => uuidArgument(value)
const number = (value: number) => argument(String(value), value)
const text = (value: string) => argument(`'${value}'`, value)
const boolean = (value: boolean) => argument(String(value), value)

export const fixtureMethodDescriptors: Record<string, Record<string, FixtureMethodDescriptor>> = {
  Beatmaps: {
    ...commonMethodDescriptors,
    byId: eq('ID', id(FIXTURE_IDS.beatmapSafe)),
    byBpmAbove: gte('BPM', number(180)),
    byBpmBelow: lte('BPM', number(220)),
    byBpmBetween: between('BPM', number(180), number(220)),
    byStarRatingAbove: gte('StarRating', number(5)),
    byStarRatingBelow: lte('StarRating', number(7)),
    byStarRatingBetween: between('StarRating', number(5), number(7)),
    byLengthAbove: gte('Length', number(120000)),
    byLengthBelow: lte('Length', number(240000)),
    byLengthBetween: between('Length', number(120000), number(240000)),
    byBeatDivisor: eq('BeatDivisor', number(4)),
    byOnlineId: eq('OnlineID', number(506483)),
    byStatus: eq('Status', number(1)),
    byTotalObjectCountAbove: gte('TotalObjectCount', number(500)),
    byTotalObjectCountBelow: lte('TotalObjectCount', number(1000)),
    byEndTimeObjectCountAbove: gte('EndTimeObjectCount', number(10)),
    byEndTimeObjectCountBelow: lte('EndTimeObjectCount', number(50)),
    byDifficultyName: eq('DifficultyName', text('Insane')),
    byDifficultyNameContains: contains('DifficultyName', text('Hard')),
    byHash: eq('Hash', hashArgument()),
    byMd5: eq('MD5Hash', md5Argument()),
    byHidden: eq('Hidden', boolean(true)),
    byLastPlayedBefore: lt('LastPlayed', dateArgument()),
    byLastPlayedAfter: gt('LastPlayed', dateArgument()),
    byLastLocalUpdateBefore: lt('LastLocalUpdate', dateArgument()),
    byLastLocalUpdateAfter: gt('LastLocalUpdate', dateArgument()),
    byLastOnlineUpdateBefore: lt('LastOnlineUpdate', dateArgument()),
    byLastOnlineUpdateAfter: gt('LastOnlineUpdate', dateArgument()),
    bySetId: eq('BeatmapSet.ID', id(FIXTURE_IDS.setReferenced)),
    bySetOnlineId: eq('BeatmapSet.OnlineID', number(506483)),
    byRuleset: eq('Ruleset.ShortName', text('osu')),
    byTitle: eq('Metadata.Title', text('Make A Move')),
    byTitleContains: contains('Metadata.Title', text('Move')),
    byArtist: eq('Metadata.Artist', text('Icon For Hire')),
    byArtistContains: contains('Metadata.Artist', text('Hire')),
    byAuthorContains: contains('Metadata.Author.Username', text('wajinshu')),
    byAuthorOnlineId: eq('Metadata.Author.OnlineID', number(124493)),
  },
  Sets: {
    ...commonMethodDescriptors,
    byId: eq('ID', id(FIXTURE_IDS.setSafe)),
    byOnlineId: eq('OnlineID', number(506483)),
    byStatus: eq('Status', number(1)),
    byHash: eq('Hash', hashArgument()),
    byDeletePending: eq('DeletePending', boolean(true)),
    byProtected: eq('Protected', boolean(true)),
    byDateAddedBefore: lt('DateAdded', dateArgument()),
    byDateAddedAfter: gt('DateAdded', dateArgument()),
    byDateSubmittedBefore: lt('DateSubmitted', dateArgument()),
    byDateSubmittedAfter: gt('DateSubmitted', dateArgument()),
    byDateRankedBefore: lt('DateRanked', dateArgument()),
    byDateRankedAfter: gt('DateRanked', dateArgument()),
    byBeatmapMd5: anyEq('Beatmaps.MD5Hash', md5Argument()),
    byBeatmapOnlineId: anyEq('Beatmaps.OnlineID', number(506483)),
    withFile: anyEq('Files.Filename', text('audio.mp3')),
  },
  Scores: {
    ...commonMethodDescriptors,
    byId: eq('ID', id(FIXTURE_IDS.scoreSafe)),
    byTotalScoreAbove: gte('TotalScore', number(1000000)),
    byTotalScoreBelow: lte('TotalScore', number(500000)),
    byMaxComboAbove: gte('MaxCombo', number(500)),
    byMaxComboBelow: lte('MaxCombo', number(1000)),
    byAccuracyAbove: gte('Accuracy', number(0.95)),
    byAccuracyBelow: lte('Accuracy', number(0.5)),
    byComboAbove: gte('Combo', number(300)),
    byComboBelow: lte('Combo', number(100)),
    byOnlineId: eq('OnlineID', number(1518856368)),
    byLegacyOnlineId: eq('LegacyOnlineID', number(1518856368)),
    byRank: eq('Rank', number(5)),
    byRankAbove: gte('Rank', number(4)),
    byClientVersion: eq('ClientVersion', text('20131110')),
    byModsContains: contains('Mods', text('HD')),
    byDateBefore: lt('Date', dateArgument()),
    byDateAfter: gt('Date', dateArgument()),
    byDeletePending: eq('DeletePending', boolean(true)),
    byIsLegacyScore: eq('IsLegacyScore', boolean(true)),
    byBackgroundReprocessingFailed: eq('BackgroundReprocessingFailed', boolean(true)),
    byBeatmapId: eq('BeatmapInfo.ID', id(FIXTURE_IDS.beatmapReferenced)),
    byBeatmapOnlineId: eq('BeatmapInfo.OnlineID', number(506483)),
    byBeatmapMd5: eq('BeatmapHash', md5Argument()),
    byBeatmapSetOnlineId: eq('BeatmapInfo.BeatmapSet.OnlineID', number(506483)),
    byUserId: eq('User.OnlineID', number(124493)),
    byUsernameContains: contains('User.Username', text('Cookiezi')),
    byUserCountryCode: eq('User.CountryCode', text('KR')),
    byRuleset: eq('Ruleset.ShortName', text('osu')),
    byPpAbove: gte('PP', number(300)),
  },
  Collections: {
    ...commonMethodDescriptors,
    byId: eq('ID', id(FIXTURE_IDS.collectionSafe)),
    byName: eq('Name', text('Favorites')),
    byNameContains: contains('Name', text('Fav')),
    byLastModifiedBefore: lt('LastModified', dateArgument()),
    byLastModifiedAfter: gt('LastModified', dateArgument()),
    withBeatmap: anyEq('BeatmapMD5Hashes', md5Argument()),
    sortedByName: eq('Name', boolean(true)),
    sortedByLastModified: eq('LastModified', boolean(true)),
  },
  Rulesets: {
    ...commonMethodDescriptors,
    byShortName: eq('ShortName', text('osu')),
    byOnlineId: eq('OnlineID', number(0)),
    byName: eq('Name', text('osu!')),
    byNameContains: contains('Name', text('taiko')),
    byAvailable: eq('Available', boolean(true)),
  },
  RulesetSettings: {
    ...commonMethodDescriptors,
    byRulesetName: eq('RulesetName', text('osu')),
    byVariant: eq('Variant', number(0)),
    byKey: eq('Key', text('BeatmapListing')),
    byKeyContains: contains('Key', text('Beatmap')),
    byValue: eq('Value', text('1')),
    byValueContains: contains('Value', text('enabled')),
  },
  Skins: {
    ...commonMethodDescriptors,
    byId: eq('ID', id(FIXTURE_IDS.skinSafe)),
    byName: eq('Name', text('WhiteCat')),
    byNameContains: contains('Name', text('White')),
    byCreatorContains: contains('Creator', text('cyperdark')),
    byHash: eq('Hash', hashArgument()),
    byInstantiationInfoContains: contains('InstantiationInfo', text('osu.Game')),
    byProtected: eq('Protected', boolean(true)),
    byDeletePending: eq('DeletePending', boolean(true)),
    withFile: anyEq('Files.Filename', text('cursor.png')),
    builtIn: noArguments(),
    user: noArguments(),
    usable: noArguments(),
  },
  Files: {
    ...commonMethodDescriptors,
    byHash: eq('Hash', hashArgument()),
  },
  Keybindings: {
    ...commonMethodDescriptors,
    byId: eq('ID', id(FIXTURE_IDS.keybindingSafe)),
    byRulesetName: eq('RulesetName', text('osu')),
    byAction: eq('Action', number(1)),
    byVariant: eq('Variant', number(0)),
  },
  ModPresets: {
    ...commonMethodDescriptors,
    byId: eq('ID', id(FIXTURE_IDS.modPresetSafe)),
    byName: eq('Name', text('HD')),
    byNameContains: contains('Name', text('DT')),
    byDescriptionContains: contains('Description', text('hidden')),
    byModsContains: contains('Mods', text('HD')),
    byDeletePending: eq('DeletePending', boolean(true)),
    byRuleset: eq('Ruleset.ShortName', text('osu')),
  },
  Metadata: {
    ...commonMethodDescriptors,
    byTitle: eq('Title', text('Make A Move')),
    byTitleContains: contains('Title', text('Move')),
    byTitleUnicode: eq('TitleUnicode', text('メイク・ア・ムーブ')),
    byTitleUnicodeContains: contains('TitleUnicode', text('メイク')),
    byArtist: eq('Artist', text('Icon For Hire')),
    byArtistContains: contains('Artist', text('Hire')),
    byArtistUnicode: eq('ArtistUnicode', text('アイコン・フォー・ハイヤー')),
    byArtistUnicodeContains: contains('ArtistUnicode', text('アイコン')),
    bySource: eq('Source', text('osu!')),
    bySourceContains: contains('Source', text('osu')),
    byTagsContains: contains('Tags', text('rock')),
    byAudioFile: eq('AudioFile', text('audio.mp3')),
    byBackgroundFile: eq('BackgroundFile', text('background.jpg')),
    byPreviewTimeAbove: gte('PreviewTime', number(30000)),
    byPreviewTimeBelow: lte('PreviewTime', number(60000)),
    byAuthorUsernameContains: contains('Author.Username', text('wajinshu')),
    byAuthorOnlineId: eq('Author.OnlineID', number(124493)),
  },
}

const builtinSkinIds = [
  'cffa69de-b3e3-4dee-8563-3c4f425c05d0',
  '9fc9cf5d-0f16-4c71-8256-98868321ac43',
  '2991cfd8-2140-469a-bcb9-2ec23fbce4ad',
  '81f02cd3-eec6-4865-ac23-fae26a386187',
  '0555c76a-cc6b-4bb4-9548-df76ba72ef25',
  'd39dfefb-477c-4372-b1ea-2bcea5fb8908',
]

const SHA = 'a'.repeat(64)
const SHA_2 = 'c'.repeat(64)
const SAFE_SHA = 'e'.repeat(64)
const MD5 = 'b'.repeat(32)
const BEFORE = '2023-12-31T12:00:00.000Z'
const AFTER = '2024-01-02T12:00:00.000Z'

const fileUsage = (filename: string, hash: string) => ({ Filename: filename, File: { Hash: hash } })
const ruleset = (shortName: string, onlineId: number, name: string, available = true) => ({
  ShortName: shortName, OnlineID: onlineId, Name: name, InstantiationInfo: 'osu.Game', Available: available, LastAppliedDifficultyVersion: 1,
})
const metadata = (unicode = false) => ({
  Title: 'Make A Move',
  TitleUnicode: unicode ? 'メイク・ア・ムーブ' : 'Make A Move',
  Artist: 'Icon For Hire',
  ArtistUnicode: unicode ? 'アイコン・フォー・ハイヤー' : 'Icon For Hire',
  Author: { OnlineID: 124493, Username: 'wajinshu', CountryCode: 'US' },
  Source: 'osu!',
  Tags: 'rock english',
  PreviewTime: 30000,
  AudioFile: 'audio.mp3',
  BackgroundFile: 'background.jpg',
  UserTags: [],
})

export function createDocumentationDatabaseFixture(): FixtureDatabaseData {
  const setSummary = { ID: FIXTURE_IDS.setReferenced, OnlineID: 506483 }
  const rulesetOsu = ruleset('osu', 0, 'osu!')
  const beatmapSafe = {
    ID: FIXTURE_IDS.beatmapSafe,
    DifficultyName: 'Insane', Ruleset: rulesetOsu, Difficulty: { DrainRate: 5, CircleSize: 4, OverallDifficulty: 6, ApproachRate: 9, SliderMultiplier: 1.4, SliderTickRate: 1 },
    Metadata: metadata(true), BeatmapSet: setSummary, Status: 1, OnlineID: 506483, Length: 100000, BPM: 160, Hash: SHA, StarRating: 4, MD5Hash: MD5,
    Hidden: false, BeatDivisor: 4, UserSettings: { Offset: 0 }, OnlineMD5Hash: MD5, LastLocalUpdate: BEFORE, LastOnlineUpdate: BEFORE, LastPlayed: BEFORE,
    EditorTimestamp: 0, EndTimeObjectCount: 5, TotalObjectCount: 400,
  }
  const beatmapReferenced = {
    ...beatmapSafe,
    ID: FIXTURE_IDS.beatmapReferenced, BPM: 200, Length: 180000, StarRating: 6, EndTimeObjectCount: 30, TotalObjectCount: 800,
    DifficultyName: 'Hard', Hidden: true,
    LastLocalUpdate: AFTER, LastOnlineUpdate: AFTER, LastPlayed: AFTER,
    Metadata: metadata(false),
  }
  const beatmapSummary = (beatmap: FixtureRow) => ({ ID: beatmap.ID, OnlineID: beatmap.OnlineID, MD5Hash: beatmap.MD5Hash })
  const setSafe = {
    ID: FIXTURE_IDS.setSafe, OnlineID: 506000, DateAdded: BEFORE, Beatmaps: [], Files: [], Status: 0, DeletePending: false, Hash: SHA_2,
    Protected: false, DateSubmitted: BEFORE, DateRanked: BEFORE,
  }
  const setReferenced = {
    ID: FIXTURE_IDS.setReferenced, OnlineID: 506483, DateAdded: AFTER, Beatmaps: [beatmapSummary(beatmapSafe), beatmapSummary(beatmapReferenced)],
    Files: [fileUsage('audio.mp3', SHA), fileUsage('background.jpg', SHA_2)], Status: 1, DeletePending: true, Hash: SHA, Protected: true,
    DateSubmitted: AFTER, DateRanked: AFTER,
  }
  const user = { OnlineID: 124493, Username: 'Cookiezi', CountryCode: 'KR' }
  const scoreSafe = {
    ID: FIXTURE_IDS.scoreSafe, BeatmapInfo: beatmapReferenced, Ruleset: rulesetOsu, Files: [], Hash: undefined, DeletePending: false,
    TotalScore: 400000, MaxCombo: 100, Accuracy: 0.4, Date: BEFORE, PP: 100, OnlineID: 1518856368, User: user, Mods: 'NM', Statistics: '{}', Rank: 1,
    Combo: 100, MaximumStatistics: '{}', BeatmapHash: MD5, IsLegacyScore: false, ClientVersion: '20131110', TotalScoreWithoutMods: 400000,
    TotalScoreVersion: 30000018, LegacyTotalScore: 400000, BackgroundReprocessingFailed: false, LegacyOnlineID: 1518856368, Pauses: [],
  }
  const scoreHigh = {
    ...scoreSafe, ID: FIXTURE_IDS.scoreHigh, DeletePending: true, TotalScore: 1338419, MaxCombo: 871, Accuracy: 0.9913, Date: AFTER, PP: 302,
    Mods: '[{"acronym":"HD"}]', Rank: 5, Combo: 871, IsLegacyScore: true, BackgroundReprocessingFailed: true,
  }
  const collectionSafe = { ID: FIXTURE_IDS.collectionSafe, Name: 'Other', BeatmapMD5Hashes: [], LastModified: BEFORE }
  const collectionFavorites = { ID: FIXTURE_IDS.collectionFavorites, Name: 'Favorites', BeatmapMD5Hashes: [MD5], LastModified: AFTER }
  const skins: FixtureRow[] = [
    { ID: FIXTURE_IDS.skinSafe, Name: 'WhiteCat', Creator: 'cyperdark', InstantiationInfo: 'osu.Game', Hash: SHA, Protected: false, Files: [], DeletePending: false },
    { ID: FIXTURE_IDS.skinWithFile, Name: 'Cursor Skin', Creator: 'osu!', InstantiationInfo: 'osu.Game', Hash: SHA_2, Protected: false, Files: [fileUsage('cursor.png', SHA)], DeletePending: false },
    { ID: FIXTURE_IDS.skinProtected, Name: 'Protected Skin', Creator: 'osu!', InstantiationInfo: 'osu.Game', Hash: SHA_2, Protected: true, Files: [], DeletePending: false },
    { ID: FIXTURE_IDS.skinPending, Name: 'Pending Skin', Creator: 'osu!', InstantiationInfo: 'osu.Game', Hash: SHA_2, Protected: false, Files: [], DeletePending: true },
    ...builtinSkinIds.map((skinId, index) => ({ ID: skinId, Name: `Built-in ${index + 1}`, Creator: 'osu!', InstantiationInfo: 'osu.Game', Hash: SHA_2, Protected: true, Files: [], DeletePending: false })),
  ]
  return {
    Beatmap: [beatmapSafe, beatmapReferenced],
    BeatmapSet: [setSafe, setReferenced],
    Score: [scoreSafe, scoreHigh],
    BeatmapCollection: [collectionSafe, collectionFavorites],
    Ruleset: [ruleset('unused', -1, 'Unused', false), rulesetOsu, ruleset('taiko', 1, 'osu!taiko')],
    RulesetSetting: [
      { RulesetName: 'osu', Variant: 0, Key: 'BeatmapListing', Value: '1' },
      { RulesetName: 'osu', Variant: 0, Key: 'ScoreDisplay', Value: 'enabled' },
    ],
    Skin: skins,
    File: [{ Hash: SAFE_SHA }, { Hash: SHA }, { Hash: SHA_2 }],
    KeyBinding: [{ ID: FIXTURE_IDS.keybindingSafe, RulesetName: 'osu', Variant: 0, Action: 1, KeyCombination: 'Z' }],
    ModPreset: [
      { ID: FIXTURE_IDS.modPresetSafe, Ruleset: rulesetOsu, Name: 'HD', Description: 'Hidden detail', Mods: 'HD', DeletePending: false },
      { ID: FIXTURE_IDS.modPresetSecond, Ruleset: rulesetOsu, Name: 'DT preset', Description: 'Speed', Mods: 'DT', DeletePending: true },
    ],
  }
}

type Predicate = { descriptor: FixtureMethodDescriptor; args: unknown[] }
type Table = { name: string; rows: FixtureRow[] }

function clone<T>(value: T, seen = new Map<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return new Date(value.getTime()) as T
  if (seen.has(value as object)) return seen.get(value as object) as T
  if (Array.isArray(value)) {
    const result: unknown[] = []
    seen.set(value, result)
    for (const item of value) result.push(clone(item, seen))
    return result as T
  }
  const result: Record<string, unknown> = {}
  seen.set(value as object, result)
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) result[key] = clone(item, seen)
  return result as T
}

function pathValues(value: unknown, path: string): unknown[] {
  if (!path) return [value]
  if (Array.isArray(value)) return value.flatMap(item => pathValues(item, path))
  if (value === null || value === undefined || typeof value !== 'object') return [undefined]
  const [head, ...tail] = path.split('.')
  return pathValues((value as Record<string, unknown>)[head], tail.join('.'))
}

function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).getTime()
  return value
}

function equal(left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) return comparable(left) === comparable(right)
  if (typeof left === 'string' || typeof right === 'string') return String(left) === String(right)
  return left === right
}

function matches(row: FixtureRow, predicate: Predicate): boolean {
  const values = pathValues(row, predicate.descriptor.path)
  const [first, second] = predicate.args
  if (predicate.descriptor.operator === 'any-eq') return values.some(value => equal(value, first))
  return values.some(value => {
    const left = comparable(value) as number | string | undefined
    const right = comparable(first) as number | string | undefined
    if (predicate.descriptor.operator === 'eq') return equal(value, first)
    if (predicate.descriptor.operator === 'contains') return typeof value === 'string' && value.toLocaleLowerCase().includes(String(first).toLocaleLowerCase())
    if (left === undefined || right === undefined) return false
    if (predicate.descriptor.operator === 'gte') return left >= right
    if (predicate.descriptor.operator === 'lte') return left <= right
    if (predicate.descriptor.operator === 'gt') return left > right
    if (predicate.descriptor.operator === 'lt') return left < right
    return left >= right && left <= (comparable(second) as number | string)
  })
}

function sortValue(row: FixtureRow, path: string): unknown {
  return comparable(pathValues(row, path)[0])
}

function compare(left: unknown, right: unknown, ascending: boolean): number {
  if (left === right) return 0
  if (left === undefined || left === null) return 1
  if (right === undefined || right === null) return -1
  const result = (left as string | number) < (right as string | number) ? -1 : 1
  return ascending ? result : -result
}

class FixtureEditSession {
  private closed = false
  private readonly drafts: FixtureRow[]

  constructor(private readonly table: Table, private readonly originals: FixtureRow[]) {
    this.drafts = originals.map(row => clone(row))
    return new Proxy(this, {
      get: (target, property, receiver) => {
        if (property in target || property === 'then') {
          const value = Reflect.get(target, property, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        }
        const value = Reflect.get(target.drafts, property)
        return typeof value === 'function' ? value.bind(target.drafts) : value
      },
    })
  }

  get length(): number { return this.drafts.length }
  [Symbol.iterator](): Iterator<FixtureRow> { return this.drafts[Symbol.iterator]() }
  at(index: number): FixtureRow | undefined { return this.drafts.at(index) }
  forEach(callback: (value: FixtureRow, index: number, array: FixtureRow[]) => void): void { this.drafts.forEach(callback) }
  map<T>(callback: (value: FixtureRow, index: number, array: FixtureRow[]) => T): T[] { return this.drafts.map(callback) }

  commit(): void {
    if (this.closed) return
    for (let index = 0; index < this.originals.length; index++) {
      for (const key of Object.keys(this.originals[index])) delete this.originals[index][key]
      Object.assign(this.originals[index], clone(this.drafts[index]))
    }
    this.closed = true
  }

  rollback(): void {
    this.closed = true
  }

  [Symbol.dispose](): void { this.commit() }
}

class FixtureQuery {
  private readonly predicates: Predicate[]
  private readonly limitValue: number | undefined
  private readonly sort: { path: string; ascending: boolean } | undefined

  constructor(private readonly table: Table, private readonly facade: string, predicates: Predicate[] = [], limitValue?: number, sort?: { path: string; ascending: boolean }) {
    this.predicates = predicates
    this.limitValue = limitValue
    this.sort = sort
    return new Proxy(this, {
      get: (target, property, receiver) => {
        if (typeof property === 'string' && property in target) return Reflect.get(target, property, receiver)
        if (typeof property === 'string') {
          if (property === 'sortedByName') return (ascending = true) => target.sortedBy('Name', ascending)
          if (property === 'sortedByLastModified') return (ascending = false) => target.sortedBy('LastModified', ascending)
          if (property === 'builtIn') return () => target.skinSubset('builtIn')
          if (property === 'user') return () => target.skinSubset('user')
          if (property === 'usable') return () => target.skinSubset('usable')
          const descriptor = fixtureMethodDescriptors[target.facade]?.[property]
          if (descriptor) return (...args: unknown[]) => target.withPredicate(descriptor, args)
        }
        const values = target.toArray()
        const value = Reflect.get(values, property)
        return typeof value === 'function' ? value.bind(values) : value
      },
    })
  }

  private withPredicate(descriptor: FixtureMethodDescriptor, args: unknown[]): FixtureQuery {
    return new FixtureQuery(this.table, this.facade, [...this.predicates, { descriptor, args }], this.limitValue, this.sort)
  }

  private rows(applyLimit: boolean): FixtureRow[] {
    let result = this.table.rows.filter(row => this.predicates.every(predicate => matches(row, predicate)))
    if (this.sort) result = [...result].sort((left, right) => compare(sortValue(left, this.sort!.path), sortValue(right, this.sort!.path), this.sort!.ascending))
    if (applyLimit && this.limitValue !== undefined) result = result.slice(0, this.limitValue)
    return result
  }

  private skinSubset(kind: 'builtIn' | 'user' | 'usable'): FixtureRow[] {
    const all = this.table.rows
    const builtIn = builtinSkinIds.flatMap(id => all.filter(row => String(row.ID) === id))
    const user = all.filter(row => !builtinSkinIds.includes(String(row.ID)) && row.DeletePending === false && row.Protected === false)
      .sort((left, right) => compare(sortValue(left, 'Name'), sortValue(right, 'Name'), true))
    const selected = kind === 'builtIn' ? builtIn : kind === 'user' ? user : [...builtIn, ...user]
    return selected.map(row => clone(row))
  }

  get length(): number { return this.rows(true).length }
  [Symbol.iterator](): Iterator<FixtureRow> { return this.toArray()[Symbol.iterator]() }
  first(): FixtureRow | undefined { const row = this.rows(true)[0]; return row ? clone(row) : undefined }
  count(): number { return this.rows(false).length }
  toArray(): FixtureRow[] { return this.rows(true).map(row => clone(row)) }
  all(): FixtureRow[] { return this.toArray() }
  limit(value: number): FixtureQuery {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('limit must be a non-negative safe integer')
    return new FixtureQuery(this.table, this.facade, this.predicates, value, this.sort)
  }
  sortedBy(path: string, ascending = true): FixtureQuery { return new FixtureQuery(this.table, this.facade, this.predicates, this.limitValue, { path, ascending }) }
  autoEdit(): FixtureEditSession { return new FixtureEditSession(this.table, this.rows(true)) }
  commit(): void {}
  rollback(): void {}

  get write(): { delete(): number; update(patch: Record<string, unknown>): number } {
    return {
      delete: () => {
        const rows = this.rows(true)
        for (const row of rows) {
          const index = this.table.rows.indexOf(row)
          if (index >= 0) this.table.rows.splice(index, 1)
        }
        return rows.length
      },
      update: patch => {
        if (Object.keys(patch).some(key => ['ID', 'Hash', 'MD5Hash', 'Files'].includes(key))) throw new Error('Protected fields cannot be updated through a result')
        const rows = this.rows(true)
        for (const row of rows) Object.assign(row, clone(patch))
        return rows.length
      },
    }
  }
}

export type FixtureDatabase = {
  beatmaps: { get: FixtureQuery }
  sets: { get: FixtureQuery }
  scores: { get: FixtureQuery }
  collections: { get: FixtureQuery }
  rulesets: { get: FixtureQuery }
  rulesetSettings: { get: FixtureQuery }
  skins: { get: FixtureQuery }
  files: { get: FixtureQuery }
  keybindings: { get: FixtureQuery }
  modpresets: { get: FixtureQuery }
  metadata: { get: FixtureQuery }
}

export function createFixtureDatabase(data: FixtureDatabaseData): FixtureDatabase {
  const tables = {
    Beatmaps: { name: 'Beatmap', rows: data.Beatmap.map(row => clone(row)) },
    Sets: { name: 'BeatmapSet', rows: data.BeatmapSet.map(row => clone(row)) },
    Scores: { name: 'Score', rows: data.Score.map(row => clone(row)) },
    Collections: { name: 'BeatmapCollection', rows: data.BeatmapCollection.map(row => clone(row)) },
    Rulesets: { name: 'Ruleset', rows: data.Ruleset.map(row => clone(row)) },
    RulesetSettings: { name: 'RulesetSetting', rows: data.RulesetSetting.map(row => clone(row)) },
    Skins: { name: 'Skin', rows: data.Skin.map(row => clone(row)) },
    Files: { name: 'File', rows: data.File.map(row => clone(row)) },
    Keybindings: { name: 'KeyBinding', rows: data.KeyBinding.map(row => clone(row)) },
    ModPresets: { name: 'ModPreset', rows: data.ModPreset.map(row => clone(row)) },
    Metadata: { name: 'BeatmapMetadata', rows: data.Beatmap.flatMap(row => row.Metadata ? [clone(row.Metadata as FixtureRow)] : []) },
  }
  return {
    beatmaps: { get: new FixtureQuery(tables.Beatmaps, 'Beatmaps') },
    sets: { get: new FixtureQuery(tables.Sets, 'Sets') },
    scores: { get: new FixtureQuery(tables.Scores, 'Scores') },
    collections: { get: new FixtureQuery(tables.Collections, 'Collections') },
    rulesets: { get: new FixtureQuery(tables.Rulesets, 'Rulesets') },
    rulesetSettings: { get: new FixtureQuery(tables.RulesetSettings, 'RulesetSettings') },
    skins: { get: new FixtureQuery(tables.Skins, 'Skins') },
    files: { get: new FixtureQuery(tables.Files, 'Files') },
    keybindings: { get: new FixtureQuery(tables.Keybindings, 'Keybindings') },
    modpresets: { get: new FixtureQuery(tables.ModPresets, 'ModPresets') },
    metadata: { get: new FixtureQuery(tables.Metadata, 'Metadata') },
  }
}
