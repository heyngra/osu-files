/** An inclusive RGB/RGBA colour tuple. */
export type SkinIniColour = [number, number, number] | [number, number, number, number]

/** A parsed line in a skin.ini document. */
export type SkinIniNode = SkinIniLineNode | SkinIniEntryNode | SkinIniSectionNode

export type SkinIniLineNode = {
  kind: 'blank' | 'comment' | 'unknown'
  text: string
  newline: string
}

export type SkinIniEntryNode = {
  kind: 'entry'
  section: string
  key: string
  value: string
  text: string
  newline: string
}

export type SkinIniSectionNode = {
  kind: 'section'
  section: string
  text: string
  newline: string
}

/** A non-fatal issue encountered while decoding a skin.ini value. */
export type SkinIniParseIssue = {
  line: number
  section?: string
  key?: string
  message: string
  raw: string
}

/** [General] section of skin.ini. */
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
  layeredHitSounds?: boolean
  sliderBallFrames?: number
  spinnerFrequencyModulate?: boolean
  spinnerFadePlayfield?: boolean
  spinnerNoBlink?: boolean
  customComboBurstSounds?: number[]
}

/** [Colours] section of skin.ini. */
export type SkinIniColours = {
  combo?: SkinIniColour[]
  named: Record<string, SkinIniColour>
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
  named: Record<string, SkinIniColour>
}

/** A legacy Mania configuration. Unknown Mania values remain in the document AST. */
export type SkinIniManiaConfiguration = {
  keys: number
  keyLayout?: string
  columnWidth?: number[]
  columnLineWidth?: number[]
  columnSpacing?: number[]
  specialStyle?: number
  columnStart?: number
  columnRight?: number
  judgementLine?: boolean
  barlineHeight?: number
  hitPosition?: number
  lightPosition?: number
  comboPosition?: number
  scorePosition?: number
  upsideDown?: boolean
  lightFramePerSecond?: number
  separateScore?: boolean
  keysUnderNotes?: boolean
  splitStages?: boolean
  stageSeparation?: number
  widthForNoteHeightScale?: number
  comboBurstStyle?: number
  imageLookups: Record<string, string>
  customColours: Record<string, SkinIniColour>
  flipSettings: Record<string, string>
  noteBodyStyle?: number
  noteBodyStyles?: Array<number | undefined>
}

/** [Mania] settings. Legacy single-configuration fields remain for compatibility. */
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
  configurations: Record<number, SkinIniManiaConfiguration>
}

export type SkinIniValue = string | number | boolean | SkinIniColour | number[]

/** Lossless parsed skin.ini document with typed projections for known settings. */
export type SkinIniDocument = {
  source: string
  newline: '\n' | '\r\n' | '\r'
  nodes: SkinIniNode[]
  raw: Record<string, Record<string, string>>
  general: SkinIniGeneral
  colours: SkinIniColours
  fonts: SkinIniFonts
  catchTheBeat: SkinIniCatchTheBeat
  mania: SkinIniMania
  issues: SkinIniParseIssue[]
  get(section: string, key: string): string | undefined
  set(section: string, key: string, value: SkinIniValue): void
  delete(section: string, key: string): boolean
  has(section: string, key: string): boolean
}

/** Backwards-compatible alias for the parsed skin.ini document. */
export type SkinIni = SkinIniDocument

const sectionKey = (value: string) => value.trim().toLowerCase()
const syncingDocuments = new WeakSet<object>()
function strictNumber(value: string): number | undefined {
  const trimmed = value.split('//', 1)[0].trim()
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return undefined
  const result = Number(trimmed)
  return Number.isFinite(result) ? result : undefined
}

function parseColour(value: string): SkinIniColour | undefined {
  const parts = value.split('//', 1)[0].split(',').map(part => strictNumber(part))
  if ((parts.length !== 3 && parts.length !== 4) || parts.some(part => part === undefined || part < 0 || part > 255)) return undefined
  return parts as SkinIniColour
}

function parseBool(value: string): boolean | undefined {
  const normalized = value.split('//', 1)[0].trim().toLowerCase()
  if (normalized === '1' || normalized === 'true') return true
  if (normalized === '0' || normalized === 'false') return false
  return undefined
}

function formatValue(value: SkinIniValue): string {
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (Array.isArray(value)) return value.join(',')
  return String(value)
}

function readMap(raw: Record<string, Record<string, string>>, section: string): Record<string, string> {
  const wanted = sectionKey(section)
  const found = Object.keys(raw).find(name => sectionKey(name) === wanted)
  return found ? raw[found] : {}
}

function readValue(map: Record<string, string>, key: string): string | undefined {
  const found = Object.keys(map).find(name => sectionKey(name) === sectionKey(key))
  return found === undefined ? undefined : map[found]
}

function numberValue(map: Record<string, string>, key: string, issues: SkinIniParseIssue[], section: string): number | undefined {
  const value = readValue(map, key)
  if (value === undefined) return undefined
  const result = strictNumber(value)
  if (result === undefined) issues.push({ line: 0, section, key, message: 'Invalid number', raw: value })
  return result
}

function boolValue(map: Record<string, string>, key: string, issues: SkinIniParseIssue[], section: string): boolean | undefined {
  const value = readValue(map, key)
  if (value === undefined) return undefined
  const result = parseBool(value)
  if (result === undefined) issues.push({ line: 0, section, key, message: 'Invalid boolean', raw: value })
  return result
}

function colourValue(map: Record<string, string>, key: string, issues: SkinIniParseIssue[], section: string): SkinIniColour | undefined {
  const value = readValue(map, key)
  if (value === undefined) return undefined
  const result = parseColour(value)
  if (!result) issues.push({ line: 0, section, key, message: 'Invalid colour', raw: value })
  return result
}

function project(document: Omit<SkinIniDocument, 'general' | 'colours' | 'fonts' | 'catchTheBeat' | 'mania'>): SkinIniDocument {
  const issues = document.issues
  const generalMap = readMap(document.raw, 'General')
  const coloursMap = readMap(document.raw, 'Colours')
  const fontsMap = readMap(document.raw, 'Fonts')
  const catchMap = readMap(document.raw, 'CatchTheBeat')
  const maniaMap = readMap(document.raw, 'Mania')
  const general: SkinIniGeneral = {
    name: readValue(generalMap, 'Name'), author: readValue(generalMap, 'Author'), version: readValue(generalMap, 'Version'),
    animationFramerate: numberValue(generalMap, 'AnimationFramerate', issues, 'General'),
    cursorCentre: boolValue(generalMap, 'CursorCentre', issues, 'General'), cursorExpand: boolValue(generalMap, 'CursorExpand', issues, 'General'),
    cursorRotate: boolValue(generalMap, 'CursorRotate', issues, 'General'), cursorTrailRotate: boolValue(generalMap, 'CursorTrailRotate', issues, 'General'),
    comboBurstRandom: boolValue(generalMap, 'ComboBurstRandom', issues, 'General'), hitCircleOverlayAboveNumber: boolValue(generalMap, 'HitCircleOverlayAboveNumber', issues, 'General'),
    allowSliderBallTint: boolValue(generalMap, 'AllowSliderBallTint', issues, 'General'), sliderBallFlip: boolValue(generalMap, 'SliderBallFlip', issues, 'General'),
    sliderStyle: numberValue(generalMap, 'SliderStyle', issues, 'General'), layeredHitSounds: boolValue(generalMap, 'LayeredHitSounds', issues, 'General'),
    sliderBallFrames: numberValue(generalMap, 'SliderBallFrames', issues, 'General'), spinnerFrequencyModulate: boolValue(generalMap, 'SpinnerFrequencyModulate', issues, 'General'),
    spinnerFadePlayfield: boolValue(generalMap, 'SpinnerFadePlayfield', issues, 'General'), spinnerNoBlink: boolValue(generalMap, 'SpinnerNoBlink', issues, 'General'),
  }
  const colours: SkinIniColours = { named: {} }
  const combo: SkinIniColour[] = []
  for (let i = 1; ; i++) { const value = colourValue(coloursMap, `Combo${i}`, issues, 'Colours'); if (!value) break; combo.push(value) }
  if (combo.length) colours.combo = combo
  for (const key of Object.keys(coloursMap)) { const value = parseColour(coloursMap[key]); if (value) colours.named[key] = value }
  const colourFields = ['MenuGlow', 'InputOverlayText', 'SliderBorder', 'SliderTrackOverride', 'SongSelectActiveText', 'SongSelectInactiveText', 'SpinnerBackground'] as const
  for (const key of colourFields) colours[key.charAt(0).toLowerCase() + key.slice(1) as keyof SkinIniColours] = colourValue(coloursMap, key, issues, 'Colours') as never
  const fonts: SkinIniFonts = {
    hitCirclePrefix: readValue(fontsMap, 'HitCirclePrefix'), hitCircleOverlap: numberValue(fontsMap, 'HitCircleOverlap', issues, 'Fonts'),
    scorePrefix: readValue(fontsMap, 'ScorePrefix'), scoreOverlap: numberValue(fontsMap, 'ScoreOverlap', issues, 'Fonts'),
    comboPrefix: readValue(fontsMap, 'ComboPrefix'), comboOverlap: numberValue(fontsMap, 'ComboOverlap', issues, 'Fonts'),
  }
  const catchTheBeat: SkinIniCatchTheBeat = { named: {} }
  for (const key of Object.keys(catchMap)) { const value = parseColour(catchMap[key]); if (value) catchTheBeat.named[key] = value }
  catchTheBeat.hyperDashColour = colourValue(catchMap, 'HyperDashColour', issues, 'CatchTheBeat')
  catchTheBeat.hyperDashTargetColour = colourValue(catchMap, 'HyperDashTargetColour', issues, 'CatchTheBeat')
  const mania: SkinIniMania = { configurations: {} }
  mania.keys = numberValue(maniaMap, 'Keys', issues, 'Mania'); mania.keyLayout = readValue(maniaMap, 'KeyLayout')
  mania.stageLeft = numberValue(maniaMap, 'StageLeft', issues, 'Mania'); mania.stageRight = numberValue(maniaMap, 'StageRight', issues, 'Mania'); mania.stageBottom = numberValue(maniaMap, 'StageBottom', issues, 'Mania')
  mania.stageHitPosition = numberValue(maniaMap, 'StageHitPosition', issues, 'Mania'); mania.lightPlayer = boolValue(maniaMap, 'LightPlayer', issues, 'Mania')
  mania.columnSpacing = numberValue(maniaMap, 'ColumnSpacing', issues, 'Mania'); mania.timingNoteSkin = readValue(maniaMap, 'TimingNoteSkin'); mania.noteBodyStyle = numberValue(maniaMap, 'NoteBodyStyle', issues, 'Mania')
  if (mania.keys !== undefined) mania.configurations[mania.keys] = { keys: mania.keys, keyLayout: mania.keyLayout, imageLookups: {}, customColours: {}, flipSettings: {}, noteBodyStyle: mania.noteBodyStyle }
  return { ...document, general, colours, fonts, catchTheBeat, mania }
}

function rebuildRaw(nodes: SkinIniNode[]): Record<string, Record<string, string>> {
  const raw: Record<string, Record<string, string>> = {}
  let section = ''
  for (const node of nodes) {
    if (node.kind === 'section') { section = node.section; raw[section] ??= {}; continue }
    if (node.kind === 'entry') { raw[section] ??= {}; raw[section][node.key] = node.value }
  }
  return raw
}

function createDocument(content: string, nodes: SkinIniNode[], raw: Record<string, Record<string, string>>, issues: SkinIniParseIssue[]): SkinIniDocument {
  const newline = (content.match(/\r\n|\r|\n/)?.[0] ?? '\n') as '\n' | '\r\n' | '\r'
  const document = {
    source: content, newline, nodes, raw, issues,
    get(section: string, key: string) { const map = readMap(this.raw, section); return readValue(map, key) },
    has(section: string, key: string) { return this.get(section, key) !== undefined },
    set(section: string, key: string, value: SkinIniValue) {
      if (!syncingDocuments.has(this)) syncTypedProjection(this)
      const wantedSection = sectionKey(section); const wantedKey = sectionKey(key)
      const entry = this.nodes.find(node => node.kind === 'entry' && sectionKey(node.section) === wantedSection && sectionKey(node.key) === wantedKey) as SkinIniEntryNode | undefined
      if (entry) { entry.value = formatValue(value); entry.text = `${entry.key}: ${entry.value}` }
      else {
        let sectionNode = this.nodes.find(node => node.kind === 'section' && sectionKey(node.section) === wantedSection) as SkinIniSectionNode | undefined
        if (!sectionNode) { sectionNode = { kind: 'section', section, text: `[${section}]`, newline: this.newline }; this.nodes.push(sectionNode) }
        const index = this.nodes.indexOf(sectionNode); this.nodes.splice(index + 1, 0, { kind: 'entry', section: sectionNode.section, key, value: formatValue(value), text: `${key}: ${formatValue(value)}`, newline: this.newline })
      }
      this.raw = rebuildRaw(this.nodes)
      Object.assign(this, project(this as never))
    },
    delete(section: string, key: string) {
      const before = this.nodes.length; const wantedSection = sectionKey(section); const wantedKey = sectionKey(key)
      this.nodes = this.nodes.filter(node => !(node.kind === 'entry' && sectionKey(node.section) === wantedSection && sectionKey(node.key) === wantedKey))
      this.raw = rebuildRaw(this.nodes); if (this.nodes.length !== before) Object.assign(this, project(this as never)); return this.nodes.length !== before
    },
  } as SkinIniDocument
  return project(document as never)
}

function syncTypedProjection(document: SkinIniDocument): void {
  if (syncingDocuments.has(document)) return
  syncingDocuments.add(document)
  try {
  const general: Array<[keyof SkinIniGeneral, string]> = [
    ['name', 'Name'], ['author', 'Author'], ['version', 'Version'], ['animationFramerate', 'AnimationFramerate'],
    ['cursorCentre', 'CursorCentre'], ['cursorExpand', 'CursorExpand'], ['cursorRotate', 'CursorRotate'], ['cursorTrailRotate', 'CursorTrailRotate'],
    ['comboBurstRandom', 'ComboBurstRandom'], ['hitCircleOverlayAboveNumber', 'HitCircleOverlayAboveNumber'], ['allowSliderBallTint', 'AllowSliderBallTint'],
    ['sliderBallFlip', 'SliderBallFlip'], ['sliderStyle', 'SliderStyle'], ['layeredHitSounds', 'LayeredHitSounds'], ['sliderBallFrames', 'SliderBallFrames'],
    ['spinnerFrequencyModulate', 'SpinnerFrequencyModulate'], ['spinnerFadePlayfield', 'SpinnerFadePlayfield'], ['spinnerNoBlink', 'SpinnerNoBlink'],
  ]
  for (const [property, key] of general) {
    const value = document.general[property]
    if (value === undefined) continue
    const current = readValue(readMap(document.raw, 'General'), key)
    const parsed = typeof value === 'boolean' ? parseBool(current ?? '') : typeof value === 'number' ? strictNumber(current ?? '') : current
    if (parsed !== value) document.set('General', key, value as SkinIniValue)
  }
  const colourFields: Array<[keyof SkinIniColours, string]> = [
    ['menuGlow', 'MenuGlow'], ['inputOverlayText', 'InputOverlayText'], ['sliderBorder', 'SliderBorder'], ['sliderTrackOverride', 'SliderTrackOverride'],
    ['songSelectActiveText', 'SongSelectActiveText'], ['songSelectInactiveText', 'SongSelectInactiveText'], ['spinnerBackground', 'SpinnerBackground'],
  ]
  for (const [property, key] of colourFields) {
    const value = document.colours[property]
    if (!Array.isArray(value)) continue
    const current = colourValue(readMap(document.raw, 'Colours'), key, [], 'Colours')
    if (JSON.stringify(current) !== JSON.stringify(value)) document.set('Colours', key, value as SkinIniColour)
  }
  if (document.colours.combo) {
    for (let index = 0; index < document.colours.combo.length; index++) {
      const key = `Combo${index + 1}`
      const current = colourValue(readMap(document.raw, 'Colours'), key, [], 'Colours')
      if (JSON.stringify(current) !== JSON.stringify(document.colours.combo[index])) document.set('Colours', key, document.colours.combo[index])
    }
  }
  const fonts: Array<[keyof SkinIniFonts, string]> = [
    ['hitCirclePrefix', 'HitCirclePrefix'], ['hitCircleOverlap', 'HitCircleOverlap'], ['scorePrefix', 'ScorePrefix'], ['scoreOverlap', 'ScoreOverlap'], ['comboPrefix', 'ComboPrefix'], ['comboOverlap', 'ComboOverlap'],
  ]
  for (const [property, key] of fonts) {
    const value = document.fonts[property]
    if (value === undefined) continue
    const current = readValue(readMap(document.raw, 'Fonts'), key)
    const parsed = typeof value === 'number' ? strictNumber(current ?? '') : current
    if (parsed !== value) document.set('Fonts', key, value as SkinIniValue)
  }
  } finally {
    syncingDocuments.delete(document)
  }
}

/** Parses skin.ini text into a lossless typed document. */
export function parseSkinIni(content: string): SkinIniDocument {
  const nodes: SkinIniNode[] = []; const raw: Record<string, Record<string, string>> = {}; const issues: SkinIniParseIssue[] = []
  let section = ''; let line = 0
  const parts = content.split(/(\r\n|\r|\n)/)
  for (let index = 0; index < parts.length; index += 2) {
    const text = parts[index]; const ending = parts[index + 1] ?? ''; line++
    const trimmed = text.replace(/^\uFEFF/, '').trim()
    if (!trimmed) { nodes.push({ kind: 'blank', text, newline: ending }); continue }
    if (/^(?:\/\/|;)/.test(trimmed)) { nodes.push({ kind: 'comment', text, newline: ending }); continue }
    const sectionMatch = /^\[([^\]]+)\]$/.exec(trimmed)
    if (sectionMatch) { section = sectionMatch[1].trim(); nodes.push({ kind: 'section', section, text, newline: ending }); raw[section] ??= {}; continue }
    const colon = text.indexOf(':')
    if (colon < 0 || !section) { nodes.push({ kind: 'unknown', text, newline: ending }); issues.push({ line, section: section || undefined, message: 'Expected a section or key/value line', raw: text }); continue }
    const key = text.slice(0, colon).trim(); const value = text.slice(colon + 1).trim()
    if (!key) { nodes.push({ kind: 'unknown', text, newline: ending }); issues.push({ line, section, message: 'Empty key', raw: text }); continue }
    nodes.push({ kind: 'entry', section, key, value, text, newline: ending }); raw[section] ??= {}; raw[section][key] = value
  }
  return createDocument(content, nodes, raw, issues)
}

/** Serializes a parsed skin.ini document, preserving original formatting where possible. */
export function serializeSkinIni(document: SkinIniDocument): string {
  syncTypedProjection(document)
  return document.nodes.map(node => `${node.text}${node.newline}`).join('')
}

/** Clones a skin.ini document before applying edits. */
export function cloneSkinIni(document: SkinIniDocument): SkinIniDocument {
  return parseSkinIni(serializeSkinIni(document))
}
