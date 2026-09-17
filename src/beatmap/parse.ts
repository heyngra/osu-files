import type {
  OsuBeatmap,
  OsuGeneral,
  OsuEditor,
  OsuMetadata,
  OsuDifficulty,
  OsuEvent,
  TimingPoint,
  OsuColour,
  HitObject,
  HitCircle,
  HitSlider,
  HitSpinner,
  HitHold,
  SliderExtras,
  SliderCurveType,
  HitObjectBase,
  SampleSet,
  OverlayPosition,
} from './types.js'
import { parseStoryboard } from './storyboard/parse.js'
import type { Storyboard } from './storyboard/storyboard.js'

const HEADER_RE = /^osu\s+file\s+format\s+v(\d+)/i
const SECTION_RE = /^\[(\w+)\]$/
const KEYVAL_RE = /^(.+?)\s*:\s*(.*)$/

type Section =
  | 'General' | 'Editor' | 'Metadata' | 'Difficulty'
  | 'Events' | 'TimingPoints' | 'Colours' | 'HitObjects'

function toBool(v: string): boolean {
  return v === '1' || v.toLowerCase() === 'true'
}

function parseInt(v: string): number {
  const n = Number.parseInt(v, 10)
  return Number.isNaN(n) ? 0 : n
}

function parseFloat(v: string): number {
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? 0 : n
}

function parseSplitInts(v: string, sep: string): number[] {
  if (!v) return []
  return v.split(sep).map(s => parseInt(s.trim()))
}

/**
 * Parses .osu file content into a structured OsuBeatmap object.
 * @returns Parsed beatmap object.
 * @example
 * import { parseOsu } from 'osu-files'
 *
 * const beatmap = parseOsu(source)
 *
 * return {
 *   title: beatmap.metadata.title,
 *   objects: beatmap.hitObjects.length,
 * }
 */
export function parseOsu(content: string): OsuBeatmap {
  const lines = content.split(/\r?\n/)

  let fileFormat = 14
  let currentSection: Section | null = null

  const headerMatch = lines[0]?.match(HEADER_RE)
  if (headerMatch) fileFormat = parseInt(headerMatch[1])

  const timingOffset = fileFormat < 5 ? 24 : 0

  const general: Partial<OsuGeneral> = {
    audioFilename: '',
    audioLeadIn: 0,
    previewTime: -1,
    countdown: 0,
    sampleSet: 'normal',
    stackLeniency: 0.7,
    mode: 0,
    letterboxInBreaks: false,
    widescreenStoryboard: false,
  }
  let editor: Partial<OsuEditor> | null = null
  const metadata: Partial<OsuMetadata> = {
    title: '',
    titleUnicode: '',
    artist: '',
    artistUnicode: '',
    creator: '',
    version: '',
    source: '',
    tags: [],
    beatmapID: -1,
    beatmapSetID: -1,
  }
  const difficulty: Partial<OsuDifficulty> = {
    hpDrainRate: 0,
    circleSize: 0,
    overallDifficulty: 0,
    approachRate: 0,
    sliderMultiplier: 1,
    sliderTickRate: 1,
  }
  const events: OsuEvent[] = []
  const timingPoints: TimingPoint[] = []
  const colours: OsuColour[] = []
  const hitObjects: HitObject[] = []

  const storyboardLines: string[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('//')) continue

    const sectionMatch = line.match(SECTION_RE)
    if (sectionMatch) {
      currentSection = sectionMatch[1] as Section
      continue
    }

    if (!currentSection) continue

    switch (currentSection) {
      case 'General':
        parseGeneralLine(line, general, timingOffset)
        break
      case 'Editor':
        editor = editor ?? { bookmarks: [], distanceSpacing: 1, beatDivisor: 4, gridSize: 4, timelineZoom: 1 }
        parseEditorLine(line, editor)
        break
      case 'Metadata':
        parseMetadataLine(line, metadata)
        break
      case 'Difficulty':
        parseDifficultyLine(line, difficulty)
        break
      case 'Events':
        if (raw.startsWith(' ') || raw.startsWith('_')) {
          storyboardLines.push(raw)
        } else {
          const firstNum = /^(\d+)/.exec(line)
          if (firstNum && ['0', '1', '2'].includes(firstNum[1])) {
            parseEventLine(line, events, timingOffset)
          } else {
            storyboardLines.push(raw)
          }
        }
        break
      case 'TimingPoints':
        parseTimingPointLine(line, timingPoints, timingOffset)
        break
      case 'Colours':
        parseColourLine(line, colours)
        break
      case 'HitObjects':
        parseHitObjectLine(line, hitObjects, timingOffset, fileFormat)
        break
    }
  }

  let storyboard: Storyboard | undefined
  if (storyboardLines.length > 0) {
    storyboard = parseStoryboard(storyboardLines.join('\n'), fileFormat)
  }

  const background = events.find(e => e.type === 'background')
  if (storyboard && background) {
    storyboard.backgroundOffset = { x: background.xOffset, y: background.yOffset }
  }

  return {
    fileFormat,
    general: general as OsuGeneral,
    editor: editor ? (editor as OsuEditor) : undefined,
    metadata: metadata as OsuMetadata,
    difficulty: difficulty as OsuDifficulty,
    events,
    storyboard,
    timingPoints,
    colours,
    hitObjects,
  }
}

function parseGeneralLine(line: string, g: Partial<OsuGeneral>, timingOffset = 0): void {
  const m = line.match(KEYVAL_RE)
  if (!m) return
  const val = m[2].trim()
  switch (m[1].trim()) {
    case 'AudioFilename': g.audioFilename = val; break
    case 'AudioLeadIn': g.audioLeadIn = parseInt(val); break
    case 'PreviewTime': {
      const pt = parseInt(val)
      g.previewTime = pt === -1 ? pt : pt + timingOffset
      break
    }
    case 'Countdown': g.countdown = parseInt(val); break
    case 'SampleSet': g.sampleSet = val.toLowerCase() as SampleSet; break
    case 'StackLeniency': g.stackLeniency = parseFloat(val); break
    case 'Mode': g.mode = parseInt(val); break
    case 'LetterboxInBreaks': g.letterboxInBreaks = toBool(val); break
    case 'WidescreenStoryboard': g.widescreenStoryboard = toBool(val); break
    case 'EpilepsyWarning': g.epilepsyWarning = toBool(val); break
    case 'CountdownOffset': g.countdownOffset = parseInt(val); break
    case 'SpecialStyle': g.specialStyle = parseInt(val); break
    case 'UseSkinSprites': g.useSkinSprites = toBool(val); break
    case 'OverlayPosition': g.overlayPosition = val.toLowerCase() as OverlayPosition; break
    case 'SkinPreference': g.skinPreference = val; break
    case 'AudioHash': g.audioHash = val; break
  }
}

function parseEditorLine(line: string, e: Partial<OsuEditor>): void {
  const m = line.match(KEYVAL_RE)
  if (!m) return
  const val = m[2].trim()
  switch (m[1].trim()) {
    case 'Bookmarks':
      e.bookmarks = val ? parseSplitInts(val, ',') : []
      break
    case 'DistanceSpacing': e.distanceSpacing = parseFloat(val); break
    case 'BeatDivisor': e.beatDivisor = parseInt(val); break
    case 'GridSize': e.gridSize = parseInt(val); break
    case 'TimelineZoom': e.timelineZoom = parseFloat(val); break
  }
}

function parseMetadataLine(line: string, m: Partial<OsuMetadata>): void {
  const kv = line.match(KEYVAL_RE)
  if (!kv) return
  const val = kv[2]
  switch (kv[1].trim()) {
    case 'Title': m.title = val; break
    case 'TitleUnicode': m.titleUnicode = val; break
    case 'Artist': m.artist = val; break
    case 'ArtistUnicode': m.artistUnicode = val; break
    case 'Creator': m.creator = val; break
    case 'Version': m.version = val; break
    case 'Source': m.source = val; break
    case 'Tags': m.tags = val ? val.split(/\s+/) : []; break
    case 'BeatmapID': m.beatmapID = parseInt(val); break
    case 'BeatmapSetID': m.beatmapSetID = parseInt(val); break
  }
}

function parseDifficultyLine(line: string, d: Partial<OsuDifficulty>): void {
  const m = line.match(KEYVAL_RE)
  if (!m) return
  const val = m[2].trim()
  switch (m[1].trim()) {
    case 'HPDrainRate': d.hpDrainRate = parseFloat(val); break
    case 'CircleSize': d.circleSize = parseFloat(val); break
    case 'OverallDifficulty': d.overallDifficulty = parseFloat(val); break
    case 'ApproachRate': d.approachRate = parseFloat(val); break
    case 'SliderMultiplier': d.sliderMultiplier = parseFloat(val); break
    case 'SliderTickRate': d.sliderTickRate = parseFloat(val); break
  }
}

function parseEventLine(line: string, events: OsuEvent[], timingOffset = 0): void {
  const parts = line.split(',')
  if (parts.length < 1) return
  const eventType = parseInt(parts[0].trim())

  switch (eventType) {
    case 0: {
      events.push({
        type: 'background',
        filename: parts[2]?.replace(/^"|"$/g, '') ?? '',
        xOffset: parseInt(parts[3]?.trim()) || 0,
        yOffset: parseInt(parts[4]?.trim()) || 0,
      })
      break
    }
    case 1: {
      events.push({
        type: 'video',
        startTime: parseFloat(parts[1]?.trim()) + timingOffset,
        filename: parts[2]?.replace(/^"|"$/g, '') ?? '',
        xOffset: parseInt(parts[3]?.trim()) || 0,
        yOffset: parseInt(parts[4]?.trim()) || 0,
      })
      break
    }
    case 2: {
      events.push({
        type: 'break',
        startTime: (parseFloat(parts[1]?.trim()) || 0) + timingOffset,
        endTime: (parseFloat(parts[2]?.trim()) || 0) + timingOffset,
      })
      break
    }
  }
}

function parseTimingPointLine(line: string, points: TimingPoint[], timingOffset = 0): void {
  const parts = line.split(',')
  if (parts.length < 2) return

  const beatLength = parseFloat(parts[1].trim())
  points.push({
    time: parseFloat(parts[0].trim()) + timingOffset,
    beatLength: Math.abs(beatLength),
    meter: parseInt(parts[2]?.trim()) || 4,
    sampleSet: parseInt(parts[3]?.trim()) || 0,
    sampleIndex: parseInt(parts[4]?.trim()) || 0,
    volume: parseInt(parts[5]?.trim()) || 100,
    uninherited: beatLength >= 0,
    effects: parseInt(parts[6]?.trim()) || 0,
  })
}

function parseColourLine(line: string, colours: OsuColour[]): void {
  const m = line.match(/^(.+?)\s*:\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/)
  if (!m) return
  colours.push({
    name: m[1].trim(),
    r: parseInt(m[2]),
    g: parseInt(m[3]),
    b: parseInt(m[4]),
  })
}


function parseHitObjectLine(line: string, objects: HitObject[], timingOffset = 0, fileFormat = 14): void {
  const parts = line.split(',')
  if (parts.length < 5) return

  const parsePosition = fileFormat >= 128 ? parseFloat : parseInt
  const x = parsePosition(parts[0].trim())
  const y = parsePosition(parts[1].trim())
  const time = parseFloat(parts[2].trim()) + timingOffset
  const type = parseInt(parts[3].trim())
  const hitSound = parseInt(parts[4].trim())
  const isNewCombo = (type & 4) !== 0
  const comboOffset = (type >> 4) & 7

  const base: HitObjectBase = {
    x, y, time, type, hitSound, isNewCombo, comboOffset,
  }

  const rawExtras = parts.slice(5).join(',')

  if (type & 8) {
    objects.push(parseSpinner(base, rawExtras, timingOffset))
  } else if (type & 2) {
    objects.push(parseSlider(base, rawExtras, fileFormat >= 128))
  } else if (type & 128) {
    objects.push(parseHold(base, rawExtras, timingOffset))
  } else {
    objects.push(parseCircle(base, rawExtras))
  }
}

function parseCircle(base: HitObjectBase, extras: string): HitCircle {
  const parts = extras.split(':')
  return {
    ...base,
    objectType: 'circle',
    sampleSet: parseInt(parts[0]) || 0,
    additionSet: parseInt(parts[1]) || 0,
    customIndex: parseInt(parts[2]) || 0,
    sampleVolume: parseInt(parts[3]) || 0,
    filename: parts[4] || undefined,
  }
}

function parseSlider(base: HitObjectBase, extras: string, fractionalCoordinates = false): HitSlider {
  const parts = extras.split(',')

  const curveRaw = parts[0] ?? ''
  const curveType = curveRaw.charAt(0) as SliderCurveType
  const curvePointsRaw = curveRaw.length > 2 ? curveRaw.substring(2) : ''
  const curvePoints = curvePointsRaw
    ? curvePointsRaw.split('|').map(pt => {
        const [px, py] = pt.split(':')
        const parsePosition = fractionalCoordinates ? parseFloat : parseInt
        return { x: parsePosition(px), y: parsePosition(py) }
      })
    : []

  const repeats = parseInt(parts[1]) || 0
  const pixelLength = parseFloat(parts[2]) || 0

  const edgeHitsounds: number[] = []
  const edgeAdditions: Array<{ sampleSet: number; additionSet: number }> = []
  const finalExtras: Record<string, number | string | undefined> = {}

  if (parts.length > 3) {
    const eh = parts[3]
    if (eh) edgeHitsounds.push(...parseSplitInts(eh, '|'))
  }
  if (parts.length > 4) {
    const ea = parts[4]
    if (ea) {
      for (const group of ea.split('|')) {
        const [ss, as] = group.split(':')
        edgeAdditions.push({
          sampleSet: parseInt(ss) || 0,
          additionSet: parseInt(as) || 0,
        })
      }
    }
  }
  if (parts.length > 5) {
    const tail = parts.slice(5).join(':')
    const tailParts = tail.split(':')
    finalExtras.sampleSet = tailParts[0] ? parseInt(tailParts[0]) : undefined
    finalExtras.additionSet = tailParts[1] ? parseInt(tailParts[1]) : undefined
    finalExtras.customIndex = tailParts[2] ? parseInt(tailParts[2]) : undefined
    finalExtras.sampleVolume = tailParts[3] ? parseInt(tailParts[3]) : undefined
    finalExtras.filename = tailParts[4] || undefined
  }

  const sliderExtras: SliderExtras = {
    curveType,
    curvePoints,
    repeats,
    pixelLength,
    edgeHitsounds,
    edgeAdditions,
    sampleSet: finalExtras.sampleSet as number | undefined,
    additionSet: finalExtras.additionSet as number | undefined,
    customIndex: finalExtras.customIndex as number | undefined,
    sampleVolume: finalExtras.sampleVolume as number | undefined,
    filename: finalExtras.filename as string | undefined,
  }

  return { ...base, objectType: 'slider', extras: sliderExtras }
}

function parseDuration(base: HitObjectBase, extras: string, objectType: 'spinner' | 'hold', timingOffset = 0): HitSpinner | HitHold {
  const [endTime, tail = ''] = extras.split(',')
  const tailParts = tail.split(':')
  return {
    ...base,
    objectType,
    extras: {
      endTime: (parseFloat(endTime) || 0) + timingOffset,
      sampleSet: tailParts[0] ? parseInt(tailParts[0]) : undefined,
      additionSet: tailParts[1] ? parseInt(tailParts[1]) : undefined,
      customIndex: tailParts[2] ? parseInt(tailParts[2]) : undefined,
      sampleVolume: tailParts[3] ? parseInt(tailParts[3]) : undefined,
      filename: tailParts[4] || undefined,
    },
  }
}

function parseSpinner(base: HitObjectBase, extras: string, timingOffset = 0): HitSpinner {
  return parseDuration(base, extras, 'spinner', timingOffset) as HitSpinner
}

function parseHold(base: HitObjectBase, extras: string, timingOffset = 0): HitHold {
  return parseDuration(base, extras, 'hold', timingOffset) as HitHold
}
