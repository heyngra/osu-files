/** `[General]` section of an .osu file. */
export type OsuGeneral = {
  /** @example 'audio.mp3' */
  audioFilename: string
  /** @example 0 */
  audioLeadIn: number
  /** @example -1 */
  previewTime: number
  /** @example 0 */
  countdown: number
  /** @example 'normal' */
  sampleSet: SampleSet
  /** @example 0.7 */
  stackLeniency: number
  /** @example 0 */
  mode: number
  /** @example true */
  letterboxInBreaks: boolean
  /** @example true */
  widescreenStoryboard: boolean
  /** @example false */
  epilepsyWarning?: boolean
  /** @example 0 */
  countdownOffset?: number
  /** @example 0 */
  specialStyle?: number
  /** @example false */
  useSkinSprites?: boolean
  /** @example 'NoChange' */
  overlayPosition?: OverlayPosition
  /** @example 'Default' */
  skinPreference?: string
  /** @example 'a1b2c3d4e5f6...' */
  audioHash?: string
}

export type SampleSet = 'normal' | 'soft' | 'drum'
export type OverlayPosition = 'NoChange' | 'Above' | 'Below'

/** `[Editor]` section of an .osu file. */
export type OsuEditor = {
  /** @example [] */
  bookmarks: number[]
  /** @example 1.2 */
  distanceSpacing: number
  /** @example 4 */
  beatDivisor: number
  /** @example 4 */
  gridSize: number
  /** @example 1 */
  timelineZoom: number
}

/** `[Metadata]` section of an .osu file. */
export type OsuMetadata = {
  /** @example 'Make A Move' */
  title: string
  /** @example 'Make A Move' */
  titleUnicode: string
  /** @example 'Icon for Hire' */
  artist: string
  /** @example 'Icon For Hire' */
  artistUnicode: string
  /** @example 'wajinshu' */
  creator: string
  /** @example 'Easy' */
  version: string
  /** @example '' */
  source: string
  /** @example ['tag1', 'tag2'] */
  tags: string[]
  /** @example 506483 */
  beatmapID: number
  /** @example 506483 */
  beatmapSetID: number
}

/** `[Difficulty]` section of an .osu file. */
export type OsuDifficulty = {
  /** @example 4 */
  hpDrainRate: number
  /** @example 3 */
  circleSize: number
  /** @example 4 */
  overallDifficulty: number
  /** @example 4 */
  approachRate: number
  /** @example 1.4 */
  sliderMultiplier: number
  /** @example 1 */
  sliderTickRate: number
}

/** A background image event. */
export type OsuBackgroundEvent = {
  type: 'background'
  filename: string
  xOffset: number
  yOffset: number
}

/** A video event. */
export type OsuVideoEvent = {
  type: 'video'
  startTime: number
  filename: string
  xOffset: number
  yOffset: number
}

/** A break (pause) event. */
export type OsuBreakEvent = {
  type: 'break'
  startTime: number
  endTime: number
}

/** Union of all .osu event types. */
export type OsuEvent = OsuBackgroundEvent | OsuVideoEvent | OsuBreakEvent

/** A timing point (red line or green line). */
export type TimingPoint = {
  /** @example 1000 */
  time: number
  /** @example 500 */
  beatLength: number
  /** @example 4 */
  meter: number
  /** @example 1 */
  sampleSet: number
  /** @example 1 */
  sampleIndex: number
  /** @example 100 */
  volume: number
  /** @example true */
  uninherited: boolean
  /** @example 0 */
  effects: number
}

/** A named combo colour. */
export type OsuColour = {
  name: string
  r: number
  g: number
  b: number
}

/**
 * Slider curve type.
 * @example
 * SliderCurveType.Bezier // 'B'
 */
export enum SliderCurveType {
  Bezier = 'B',
  Perfect = 'P',
  Linear = 'L',
  Catmull = 'C',
}

/** Base fields shared by all hit object types. */
export type HitObjectBase = {
  /** @example 256 */
  x: number
  /** @example 192 */
  y: number
  /** @example 1000 */
  time: number
  /** @example 5 */
  type: number
  /** @example 0 */
  hitSound: number
  /** @example true */
  isNewCombo: boolean
  /** @example 0 */
  comboOffset: number
}

/** A hit circle (note). */
export type HitCircle = HitObjectBase & {
  objectType: 'circle'
  sampleSet?: number
  additionSet?: number
  customIndex?: number
  sampleVolume?: number
  filename?: string
}

/** Extra data for a slider hit object. */
export type SliderExtras = {
  /** @example SliderCurveType.Bezier */
  curveType: SliderCurveType
  /** @example [{ x: 256, y: 192 }, { x: 300, y: 200 }] */
  curvePoints: Array<{ x: number; y: number }>
  /** @example 1 */
  repeats: number
  /** @example 100 */
  pixelLength: number
  /** @example [0] */
  edgeHitsounds: number[]
  /** @example [{ sampleSet: 1, additionSet: 1 }] */
  edgeAdditions: Array<{ sampleSet: number; additionSet: number }>
  /** @example 1 */
  sampleSet?: number
  /** @example 1 */
  additionSet?: number
  /** @example 0 */
  customIndex?: number
  /** @example 100 */
  sampleVolume?: number
  /** @example 'soft-hitnormal.wav' */
  filename?: string
}

/** A slider hit object. */
export type HitSlider = HitObjectBase & {
  objectType: 'slider'
  extras: SliderExtras
}

/** Extra data shared by spinners and hold notes. */
export type DurationHitObjectExtras = {
  endTime: number
  sampleSet?: number
  additionSet?: number
  customIndex?: number
  sampleVolume?: number
  filename?: string
}

/** A spinner hit object. */
export type HitSpinner = HitObjectBase & {
  objectType: 'spinner'
  extras: DurationHitObjectExtras
}

/** A hold note (mania). */
export type HitHold = HitObjectBase & {
  objectType: 'hold'
  extras: DurationHitObjectExtras
}

/** Union of all hit object types. */
export type HitObject = HitCircle | HitSlider | HitSpinner | HitHold

/**
 * Parsed contents of an .osu beatmap file.
 * @example
 * const beatmap = parseOsu(content)
 * beatmap.hitObjects.forEach(h => { ... })
 */
export type OsuBeatmap = {
  fileFormat: number
  general: OsuGeneral
  editor?: OsuEditor
  metadata: OsuMetadata
  difficulty: OsuDifficulty
  events: OsuEvent[]
  storyboard?: import('./storyboard/index.js').Storyboard
  timingPoints: TimingPoint[]
  colours: OsuColour[]
  hitObjects: HitObject[]
}
