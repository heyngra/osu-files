import type {
  OsuBeatmap, OsuGeneral, OsuEditor, OsuMetadata, OsuDifficulty,
  OsuEvent, TimingPoint, OsuColour, HitObject, HitCircle,
  HitSpinner, HitHold, SliderExtras, DurationHitObjectExtras,
} from './types.js'
import { serializeStoryboardForOsu } from './storyboard/serialize.js'

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(15).replace(/\.?0+$/, '')
}

function boolVal(v: boolean): string { return v ? '1' : '0' }

function writeGeneral(g: OsuGeneral): string {
  const lines: string[] = ['[General]']
  for (const [k, v] of Object.entries({
    AudioFilename: g.audioFilename,
    AudioLeadIn: g.audioLeadIn || undefined,
    PreviewTime: g.previewTime,
    Countdown: g.countdown || undefined,
    SampleSet: g.sampleSet !== 'normal' ? g.sampleSet : undefined,
    StackLeniency: g.stackLeniency !== 0.7 ? fmt(g.stackLeniency) : undefined,
    Mode: g.mode,
    LetterboxInBreaks: g.letterboxInBreaks || undefined,
    WidescreenStoryboard: g.widescreenStoryboard || undefined,
  })) {
    if (v !== undefined) lines.push(`${k}: ${v}`)
  }
  if (g.epilepsyWarning) lines.push(`EpilepsyWarning: ${boolVal(g.epilepsyWarning)}`)
  if (g.countdownOffset) lines.push(`CountdownOffset: ${g.countdownOffset}`)
  if (g.specialStyle) lines.push(`SpecialStyle: ${g.specialStyle}`)
  if (g.useSkinSprites) lines.push(`UseSkinSprites: ${boolVal(g.useSkinSprites)}`)
  if (g.overlayPosition) lines.push(`OverlayPosition: ${g.overlayPosition}`)
  if (g.skinPreference) lines.push(`SkinPreference: ${g.skinPreference}`)
  if (g.audioHash) lines.push(`AudioHash: ${g.audioHash}`)
  return lines.join('\n')
}

function writeEditor(e: OsuEditor): string {
  const lines: string[] = ['[Editor]']
  if (e.bookmarks.length > 0) lines.push(`Bookmarks: ${e.bookmarks.join(',')}`)
  lines.push(`DistanceSpacing: ${fmt(e.distanceSpacing)}`)
  lines.push(`BeatDivisor: ${e.beatDivisor}`)
  lines.push(`GridSize: ${e.gridSize}`)
  lines.push(`TimelineZoom: ${fmt(e.timelineZoom)}`)
  return lines.join('\n')
}

function writeMetadata(m: OsuMetadata): string {
  const lines: string[] = ['[Metadata]']
  lines.push(`Title:${m.title}`)
  if (m.titleUnicode) lines.push(`TitleUnicode:${m.titleUnicode}`)
  lines.push(`Artist:${m.artist}`)
  if (m.artistUnicode) lines.push(`ArtistUnicode:${m.artistUnicode}`)
  lines.push(`Creator:${m.creator}`)
  lines.push(`Version:${m.version}`)
  if (m.source) lines.push(`Source:${m.source}`)
  if (m.tags.length > 0) lines.push(`Tags:${m.tags.join(' ')}`)
  if (m.beatmapID > 0) lines.push(`BeatmapID:${m.beatmapID}`)
  if (m.beatmapSetID > 0) lines.push(`BeatmapSetID:${m.beatmapSetID}`)
  return lines.join('\n')
}

function writeDifficulty(d: OsuDifficulty): string {
  return [
    '[Difficulty]',
    `HPDrainRate:${fmt(d.hpDrainRate)}`,
    `CircleSize:${fmt(d.circleSize)}`,
    `OverallDifficulty:${fmt(d.overallDifficulty)}`,
    `ApproachRate:${fmt(d.approachRate)}`,
    `SliderMultiplier:${fmt(d.sliderMultiplier)}`,
    `SliderTickRate:${fmt(d.sliderTickRate)}`,
  ].join('\n')
}

function writeEvents(events: OsuEvent[]): string {
  const lines: string[] = ['[Events]']
  for (const ev of events) {
    switch (ev.type) {
      case 'background':
        lines.push(`0,0,"${ev.filename}",${ev.xOffset},${ev.yOffset}`)
        break
      case 'video':
        lines.push(`1,${ev.startTime},"${ev.filename}",${ev.xOffset},${ev.yOffset}`)
        break
      case 'break':
        lines.push(`2,${ev.startTime},${ev.endTime}`)
        break
    }
  }
  return lines.join('\n')
}

function writeTimingPoints(points: TimingPoint[]): string {
  const lines: string[] = ['[TimingPoints]']
  for (const tp of points) {
    const bl = tp.uninherited ? fmt(tp.beatLength) : `-${fmt(tp.beatLength)}`
    lines.push(`${fmt(tp.time)},${bl},${tp.meter},${tp.sampleSet},${tp.sampleIndex},${tp.volume},${tp.uninherited ? 1 : 0},${tp.effects}`)
  }
  return lines.join('\n')
}

function writeColours(colours: OsuColour[]): string {
  if (colours.length === 0) return ''
  const lines: string[] = ['[Colours]']
  for (const c of colours) {
    lines.push(`${c.name} : ${c.r},${c.g},${c.b}`)
  }
  return lines.join('\n')
}

function serializeSliderExtras(e: SliderExtras): string {
  const curve = `${e.curveType}|${e.curvePoints.map(p => `${p.x}:${p.y}`).join('|')}`
  const eh = e.edgeHitsounds.length > 0 ? e.edgeHitsounds.join('|') : ''
  const ea = e.edgeAdditions.length > 0
    ? e.edgeAdditions.map(a => `${a.sampleSet}:${a.additionSet}`).join('|')
    : ''
  let tail = ''
  if (e.sampleSet !== undefined || e.additionSet !== undefined || e.customIndex !== undefined || e.sampleVolume !== undefined || e.filename !== undefined) {
    const parts = [
      e.sampleSet ?? 0,
      e.additionSet ?? 0,
      e.customIndex ?? 0,
      e.sampleVolume ?? 0,
      e.filename ?? '',
    ]
    tail = parts.join(':')
  }
  const fields = [curve, e.repeats.toString(), fmt(e.pixelLength)]
  if (eh || ea || tail) fields.push(eh)
  if (ea || tail) fields.push(ea)
  if (tail) fields.push(tail)
  return fields.join(',')
}

function serializeCircleExtras(h: HitCircle): string {
  return `${h.sampleSet ?? 0}:${h.additionSet ?? 0}:${h.customIndex ?? 0}:${h.sampleVolume ?? 0}:${h.filename ?? ''}`
}

function serializeDurationExtrasTail(d: DurationHitObjectExtras): string {
  return `${d.sampleSet ?? 0}:${d.additionSet ?? 0}:${d.customIndex ?? 0}:${d.sampleVolume ?? 0}:${d.filename ?? ''}`
}

function serializeDurationExtras(h: HitSpinner | HitHold): string {
  return `${h.extras.endTime},${serializeDurationExtrasTail(h.extras)}`
}

function writeHitObject(obj: HitObject): string {
  const type = obj.type
  const base = `${obj.x},${obj.y},${obj.time},${type},${obj.hitSound}`
  switch (obj.objectType) {
    case 'circle': return `${base},${serializeCircleExtras(obj)}`
    case 'slider': return `${base},${serializeSliderExtras(obj.extras)}`
    case 'spinner': return `${base},${serializeDurationExtras(obj)}`
    case 'hold': return `${base},${serializeDurationExtras(obj)}`
  }
}

function writeHitObjects(objects: HitObject[]): string {
  const lines: string[] = ['[HitObjects]']
  for (const obj of objects) {
    lines.push(writeHitObject(obj))
  }
  return lines.join('\n')
}

/**
 * Serializes an OsuBeatmap back to .osu text format.
 * @returns .osu file content as string.
 * @example
 * serializeOsu(beatmap) // 'osu file format v14\\n\\n[General]...'
 */
export function serializeOsu(beatmap: OsuBeatmap): string {
  const sections: string[] = [
    `osu file format v${beatmap.fileFormat}`,
    '',
    writeGeneral(beatmap.general),
    '',
  ]

  if (beatmap.editor) {
    sections.push(writeEditor(beatmap.editor), '')
  }

  const eventsSection = writeEvents(beatmap.events)
  const sbText = beatmap.storyboard ? serializeStoryboardForOsu(beatmap.storyboard) : ''
  const finalEvents = sbText ? eventsSection + '\n' + sbText : eventsSection

  sections.push(
    writeMetadata(beatmap.metadata),
    '',
    writeDifficulty(beatmap.difficulty),
    '',
    finalEvents,
    '',
    writeTimingPoints(beatmap.timingPoints),
    '',
  )

  const colours = writeColours(beatmap.colours)
  if (colours) sections.push(colours, '')

  sections.push(writeHitObjects(beatmap.hitObjects), '')

  return sections.join('\n')
}
