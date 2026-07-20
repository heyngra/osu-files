export type OsuGeneral = {
  audioFilename: string
  audioLeadIn: number
  previewTime: number
  countdown: number
  sampleSet: string
  stackLeniency: number
  mode: number
  letterboxInBreaks: boolean
  widescreenStoryboard: boolean
  epilepsyWarning?: boolean
  countdownOffset?: number
  specialStyle?: number
  useSkinSprites?: boolean
  overlayPosition?: string
  skinPreference?: string
  audioHash?: string
}

export type OsuEditor = {
  bookmarks: number[]
  distanceSpacing: number
  beatDivisor: number
  gridSize: number
  timelineZoom: number
}

export type OsuMetadata = {
  title: string
  titleUnicode: string
  artist: string
  artistUnicode: string
  creator: string
  version: string
  source: string
  tags: string[]
  beatmapID: number
  beatmapSetID: number
}

export type OsuDifficulty = {
  hpDrainRate: number
  circleSize: number
  overallDifficulty: number
  approachRate: number
  sliderMultiplier: number
  sliderTickRate: number
}

export type OsuBackgroundEvent = {
  type: 'background'
  filename: string
  xOffset: number
  yOffset: number
}

export type OsuVideoEvent = {
  type: 'video'
  filename: string
  xOffset: number
  yOffset: number
}

export type OsuBreakEvent = {
  type: 'break'
  startTime: number
  endTime: number
}

export type OsuStoryboardEvent = {
  type: 'storyboard'
  raw: string
}

export type OsuEvent = OsuBackgroundEvent | OsuVideoEvent | OsuBreakEvent | OsuStoryboardEvent

export type TimingPoint = {
  time: number
  beatLength: number
  meter: number
  sampleSet: number
  sampleIndex: number
  volume: number
  uninherited: boolean
  effects: number
}

export type OsuColour = {
  name: string
  r: number
  g: number
  b: number
}

export type SliderCurveType = 'B' | 'P' | 'L' | 'C'

export type HitObjectBase = {
  x: number
  y: number
  time: number
  type: number
  hitSound: number
  isNewCombo: boolean
  comboOffset: number
}

export type HitCircle = HitObjectBase & {
  objectType: 'circle'
  sampleSet?: number
  additionSet?: number
  customIndex?: number
  sampleVolume?: number
  filename?: string
}

export type SliderExtras = {
  curveType: SliderCurveType
  curvePoints: Array<{ x: number; y: number }>
  repeats: number
  pixelLength: number
  edgeHitsounds: number[]
  edgeAdditions: Array<{ sampleSet: number; additionSet: number }>
  sampleSet?: number
  additionSet?: number
  customIndex?: number
  sampleVolume?: number
  filename?: string
}

export type HitSlider = HitObjectBase & {
  objectType: 'slider'
  extras: SliderExtras
}

export type SpinnerExtras = {
  endTime: number
  sampleSet?: number
  additionSet?: number
  customIndex?: number
  sampleVolume?: number
  filename?: string
}

export type HitSpinner = HitObjectBase & {
  objectType: 'spinner'
  extras: SpinnerExtras
}

export type HoldExtras = {
  endTime: number
  sampleSet?: number
  additionSet?: number
  customIndex?: number
  sampleVolume?: number
  filename?: string
}

export type HitHold = HitObjectBase & {
  objectType: 'hold'
  extras: HoldExtras
}

export type HitObject = HitCircle | HitSlider | HitSpinner | HitHold

export type OsuBeatmap = {
  fileFormat: number
  general: OsuGeneral
  editor?: OsuEditor
  metadata: OsuMetadata
  difficulty: OsuDifficulty
  events: OsuEvent[]
  timingPoints: TimingPoint[]
  colours: OsuColour[]
  hitObjects: HitObject[]
}
