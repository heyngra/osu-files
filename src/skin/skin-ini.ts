type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc['length']]>

type Range<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>

/** An RGB colour tuple [r, g, b]. */
export type SkinIniColour = [Range<0,255>, Range<0,255>, Range<0,255>]

/** [General] section of skin.ini.
 * @example
 * { name: 'WhiteCat', author: 'cyperdark', version: '2.5', animationFramerate: 60, cursorExpand: false, cursorCentre: true, allowSliderBallTint: true, sliderStyle: 2 }
 */
export type SkinIniGeneral = {
  name?: string
  author?: string
  version?: string
  animationFramerate?: number
  cursorCentre?: boolean
  cursorExpand?: boolean
  cursorRotate?: boolean
  cursorTrailRotate?: boolean
  comboBurstRandom?: boolean
  hitCircleOverlayAboveNumber?: boolean
  allowSliderBallTint?: boolean
  sliderBallFlip?: boolean
  sliderStyle?: number
}

/** [Colours] section of skin.ini. */
export type SkinIniColours = {
  combo?: SkinIniColour[]
  menuGlow?: SkinIniColour
  inputOverlayText?: SkinIniColour
  sliderBorder?: SkinIniColour
  sliderTrackOverride?: SkinIniColour
  songSelectActiveText?: SkinIniColour
  songSelectInactiveText?: SkinIniColour
  spinnerBackground?: SkinIniColour
}

/** [Fonts] section of skin.ini. */
export type SkinIniFonts = {
  hitCirclePrefix?: string
  hitCircleOverlap?: number
  scorePrefix?: string
  scoreOverlap?: number
  comboPrefix?: string
  comboOverlap?: number
}

/** [CatchTheBeat] section of skin.ini. */
export type SkinIniCatchTheBeat = {
  hyperDashColour?: SkinIniColour
  hyperDashTargetColour?: SkinIniColour
}

/** [Mania] section of skin.ini. */
export type SkinIniMania = {
  keys?: number
  keyLayout?: string
  stageLeft?: number
  stageRight?: number
  stageBottom?: number
  stageHitPosition?: number
  lightPlayer?: boolean
  columnSpacing?: number
  timingNoteSkin?: string
  noteBodyStyle?: number
}

/**
 * Parsed skin.ini data.
 * @example
 * const ini = parseSkinIni(content)
 * console.log(ini.general.name)
 */
export type SkinIni = {
  raw: Record<string, Record<string, string>>
  general: SkinIniGeneral
  colours: SkinIniColours
  fonts: SkinIniFonts
  catchTheBeat: SkinIniCatchTheBeat
  mania: SkinIniMania
}

function parseColour(value: string): SkinIniColour | undefined {
  const parts = value.split(',').map(s => parseInt(s.trim(), 10))
  if (parts.length === 3 && parts.every(n => !isNaN(n) && n >= 0 && n <= 255))
    return [parts[0], parts[1], parts[2]] as SkinIniColour
  return undefined
}

function parseIntVal(value: string): number | undefined {
  const n = parseInt(value.trim(), 10)
  return isNaN(n) ? undefined : n
}

function parseBool(value: string): boolean | undefined {
  const v = value.trim().toLowerCase()
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return undefined
}

/** Parses skin.ini text into typed sections and values.
 * @returns Parsed skin.ini data.
 * @example
 * const ini = parseSkinIni(fs.readFileSync('skin.ini', 'utf-8'))
 */
export function parseSkinIni(content: string): SkinIni {
  const raw: Record<string, Record<string, string>> = {}
  let currentSection = ''

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('//')) continue

    const sectionMatch = trimmed.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      if (!raw[currentSection]) raw[currentSection] = {}
      continue
    }

    if (!currentSection) continue

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.substring(0, colonIdx).trim()
    const value = trimmed.substring(colonIdx + 1).trim()
    if (!key) continue

    raw[currentSection][key] = value
  }

  const general: SkinIniGeneral = {}
  const gen = raw['General']
  if (gen) {
    general.name = gen['Name']
    general.author = gen['Author']
    general.version = gen['Version']
    general.animationFramerate = parseIntVal(gen['AnimationFramerate'] ?? '')
    general.cursorCentre = parseBool(gen['CursorCentre'] ?? '')
    general.cursorExpand = parseBool(gen['CursorExpand'] ?? '')
    general.cursorRotate = parseBool(gen['CursorRotate'] ?? '')
    general.cursorTrailRotate = parseBool(gen['CursorTrailRotate'] ?? '')
    general.comboBurstRandom = parseBool(gen['ComboBurstRandom'] ?? '')
    general.hitCircleOverlayAboveNumber = parseBool(gen['HitCircleOverlayAboveNumber'] ?? '')
    general.allowSliderBallTint = parseBool(gen['AllowSliderBallTint'] ?? '')
    general.sliderBallFlip = parseBool(gen['SliderBallFlip'] ?? '')
    general.sliderStyle = parseIntVal(gen['SliderStyle'] ?? '')
  }

  const colours: SkinIniColours = {}
  const col = raw['Colours']
  if (col) {
    const combo: SkinIniColour[] = []
    for (let i = 1; ; i++) {
      const c = parseColour(col[`Combo${i}`] ?? col[`Combo${i}`.toLowerCase()] ?? '')
      if (!c) break
      combo.push(c)
    }
    if (combo.length > 0) colours.combo = combo

    colours.menuGlow = parseColour(col['MenuGlow'] ?? '')
    colours.inputOverlayText = parseColour(col['InputOverlayText'] ?? '')
    colours.sliderBorder = parseColour(col['SliderBorder'] ?? '')
    colours.sliderTrackOverride = parseColour(col['SliderTrackOverride'] ?? '')
    colours.songSelectActiveText = parseColour(col['SongSelectActiveText'] ?? '')
    colours.songSelectInactiveText = parseColour(col['SongSelectInactiveText'] ?? '')
    colours.spinnerBackground = parseColour(col['SpinnerBackground'] ?? '')
  }

  const fonts: SkinIniFonts = {}
  const fnt = raw['Fonts']
  if (fnt) {
    fonts.hitCirclePrefix = fnt['HitCirclePrefix']
    fonts.hitCircleOverlap = parseIntVal(fnt['HitCircleOverlap'] ?? '')
    fonts.scorePrefix = fnt['ScorePrefix']
    fonts.scoreOverlap = parseIntVal(fnt['ScoreOverlap'] ?? '')
    fonts.comboPrefix = fnt['ComboPrefix']
    fonts.comboOverlap = parseIntVal(fnt['ComboOverlap'] ?? '')
  }

  const catchTheBeat: SkinIniCatchTheBeat = {}
  const ctb = raw['CatchTheBeat']
  if (ctb) {
    catchTheBeat.hyperDashColour = parseColour(ctb['HyperDashColour'] ?? '')
    catchTheBeat.hyperDashTargetColour = parseColour(ctb['HyperDashTargetColour'] ?? '')
  }

  const mania: SkinIniMania = {}
  const man = raw['Mania']
  if (man) {
    mania.keys = parseIntVal(man['Keys'] ?? '')
    mania.keyLayout = man['KeyLayout']
    mania.stageLeft = parseIntVal(man['StageLeft'] ?? '')
    mania.stageRight = parseIntVal(man['StageRight'] ?? '')
    mania.stageBottom = parseIntVal(man['StageBottom'] ?? '')
    mania.stageHitPosition = parseIntVal(man['StageHitPosition'] ?? '')
    mania.lightPlayer = parseBool(man['LightPlayer'] ?? '')
    mania.columnSpacing = parseIntVal(man['ColumnSpacing'] ?? '')
    mania.timingNoteSkin = man['TimingNoteSkin']
    mania.noteBodyStyle = parseIntVal(man['NoteBodyStyle'] ?? '')
  }

  return { raw, general, colours, fonts, catchTheBeat, mania }
}
