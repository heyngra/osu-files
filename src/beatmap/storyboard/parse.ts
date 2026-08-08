import { Anchor, Easing } from './types.js'
import { FileRef } from '../../types.js'
import {
  StoryboardCommandGroup,
  StoryboardLoopingGroup,
  StoryboardTriggerGroup,
} from './commands.js'
import { StoryboardSprite, StoryboardAnimation, StoryboardSample } from './elements.js'
import { Storyboard } from './storyboard.js'

function countDepth(line: string): number {
  let i = 0
  while (i < line.length && (line[i] === ' ' || line[i] === '_')) i++
  return i
}

function unquote(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1)
  return s
}

function splitFields(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; current += ch; continue }
    if (ch === ',' && !inQuotes) { fields.push(current); current = ''; continue }
    current += ch
  }
  fields.push(current)
  return fields
}

function toInt(v: string): number {
  const n = Number.parseInt(v, 10)
  return Number.isNaN(n) ? 0 : n
}

function toFloat(v: string): number {
  const n = Number.parseFloat(v)
  return Number.isNaN(n) ? 0 : n
}

const ANCHOR_FROM_INDEX: Record<number, Anchor> = {
  0: Anchor.TopLeft,
  1: Anchor.Centre,
  2: Anchor.CentreLeft,
  3: Anchor.TopRight,
  4: Anchor.BottomCentre,
  5: Anchor.TopCentre,
  7: Anchor.CentreRight,
  8: Anchor.BottomLeft,
  9: Anchor.BottomRight,
}

const LAYER_FROM_INDEX: Record<number, string> = {
  0: 'Background',
  1: 'Fail',
  2: 'Pass',
  3: 'Foreground',
  4: 'Overlay',
}

function parseOrigin(field: string): Anchor {
  const t = field.trim()
  if (/^\d+$/.test(t)) return ANCHOR_FROM_INDEX[toInt(t)] ?? Anchor.Centre
  const map: Record<string, Anchor> = {
    topleft: Anchor.TopLeft, topcentre: Anchor.TopCentre, topright: Anchor.TopRight,
    centreleft: Anchor.CentreLeft, centre: Anchor.Centre, centreright: Anchor.CentreRight,
    bottomleft: Anchor.BottomLeft, bottomcentre: Anchor.BottomCentre, bottomright: Anchor.BottomRight,
  }
  return map[t.toLowerCase()] ?? Anchor.Centre
}

function parseLayer(field: string): string {
  const t = field.trim()
  if (/^\d+$/.test(t)) return LAYER_FROM_INDEX[toInt(t)] ?? t
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function parseCommand(fields: string[], target: StoryboardCommandGroup): void {
  const type = fields[0].toUpperCase()
  const easing = toInt(fields[1]) as Easing
  const startTime = toFloat(fields[2])
  const endTimeStr = fields[3]
  const hasEndTime = endTimeStr !== undefined && endTimeStr !== ''
  const endTime = hasEndTime ? toFloat(endTimeStr) : undefined

  const f = (i: number) => fields[i] !== undefined && fields[i] !== '' ? toFloat(fields[i]) : undefined
  const has = (i: number) => fields[i] !== undefined && fields[i] !== ''

  if (type === 'F') {
    const v1 = f(4); const v2 = f(5)
    if (v1 !== undefined && v2 !== undefined) target.addAlpha(easing, startTime, endTime, v2, v1)
    else if (v1 !== undefined) target.addAlpha(easing, startTime, endTime, v1)
    return
  }
  if (type === 'M') {
    target.addX(easing, startTime, endTime, toFloat(fields[6]), toFloat(fields[4]))
    target.addY(easing, startTime, endTime, toFloat(fields[7]), toFloat(fields[5]))
    return
  }
  if (type === 'MX') {
    const v1 = has(4) ? toFloat(fields[4]) : undefined; const v2 = has(5) ? toFloat(fields[5]) : undefined
    if (v1 !== undefined && v2 !== undefined) target.addX(easing, startTime, endTime, v2, v1)
    else if (v1 !== undefined) target.addX(easing, startTime, endTime, v1)
    return
  }
  if (type === 'MY') {
    const v1 = has(4) ? toFloat(fields[4]) : undefined; const v2 = has(5) ? toFloat(fields[5]) : undefined
    if (v1 !== undefined && v2 !== undefined) target.addY(easing, startTime, endTime, v2, v1)
    else if (v1 !== undefined) target.addY(easing, startTime, endTime, v1)
    return
  }
  if (type === 'S') {
    const v1 = f(4); const v2 = f(5)
    if (v1 !== undefined && v2 !== undefined) target.addScale(easing, startTime, endTime, v2, v1)
    else if (v1 !== undefined) target.addScale(easing, startTime, endTime, v1)
    return
  }
  if (type === 'V') {
    target.addVectorScale(easing, startTime, endTime,
      { x: toFloat(fields[6]), y: toFloat(fields[7]) },
      { x: toFloat(fields[4]), y: toFloat(fields[5]) })
    return
  }
  if (type === 'R') {
    const v1 = f(4); const v2 = f(5)
    if (v1 !== undefined && v2 !== undefined) target.addRotation(easing, startTime, endTime, v2 * 180 / Math.PI, v1 * 180 / Math.PI)
    else if (v1 !== undefined) target.addRotation(easing, startTime, endTime, v1 * 180 / Math.PI)
    return
  }
  if (type === 'C') {
    target.addColour(easing, startTime, endTime,
      { r: toFloat(fields[7]), g: toFloat(fields[8]), b: toFloat(fields[9]) },
      { r: toFloat(fields[4]), g: toFloat(fields[5]), b: toFloat(fields[6]) })
    return
  }
  if (type === 'P') {
    const sub = fields[4]?.toUpperCase()
    const v1 = has(5) ? fields[5] : undefined
    const v2 = has(6) ? fields[6] : undefined
    const end = v2 ?? v1
    const start = v2 === undefined ? undefined : v1
    if (sub === 'H' && end !== undefined) {
      target.addFlipH(easing, startTime, endTime, end === '1', start === undefined ? undefined : start === '1')
      return
    }
    if (sub === 'V' && end !== undefined) {
      target.addFlipV(easing, startTime, endTime, end === '1', start === undefined ? undefined : start === '1')
      return
    }
    if (sub === 'A') {
      const blend = (value: string): 'Inherit' | 'Additive' => value === '1' ? 'Additive' : 'Inherit'
      target.addBlending(easing, startTime, endTime, end === undefined ? undefined : blend(end), start === undefined ? undefined : blend(start))
    }
  }
}

function parseElement(line: string, sb: Storyboard, formatVersion: number): StoryboardSprite | null {
  const fields = splitFields(line)
  const t0 = fields[0].trim()
  const numeric = /^\d+$/.test(t0)
  const et = numeric ? toInt(t0) : ({ Sprite: 4, Animation: 6, Sample: 5, Video: 1, Background: 0 })[t0] ?? -1

  if (et === 0) {
    sb.backgroundOffset = { x: toFloat(fields[fields.length - 2] ?? '0'), y: toFloat(fields[fields.length - 1] ?? '0') }
    sb._markDirty()
    return null
  }

  if (et === 4) {
    const layer = parseLayer(fields[1])
    const origin = parseOrigin(fields[2])
    const path = unquote(fields[3])
    const fileRef = new FileRef(path)
    const sp = new StoryboardSprite(fileRef, origin, { x: toFloat(fields[4]), y: toFloat(fields[5]) })
    sp._sb = sb
    sb.getLayer(layer).add(sp)
    return sp
  }

  if (et === 6) {
    const layer = parseLayer(fields[1])
    const origin = parseOrigin(fields[2])
    const path = unquote(fields[3])
    const fileRef = new FileRef(path)
    const loopType = toInt(fields[8]) === 1 ? 1 : 0
    let frameDelay = toFloat(fields[7])
    if (formatVersion < 6) frameDelay = Math.round(0.015 * frameDelay) * 1.186 * (1000 / 60)
    const anim = new StoryboardAnimation(fileRef, toInt(fields[6]), frameDelay, origin, { x: toFloat(fields[4]), y: toFloat(fields[5]) }, loopType)
    anim._sb = sb
    sb.getLayer(layer).add(anim)
    return anim
  }

  if (et === 5) {
    const startTime = toFloat(fields[1])
    const layer = parseLayer(fields[2])
    const path = unquote(fields[3])
    const fileRef = new FileRef(path)
    const vol = toInt(fields[4]) || 100
    sb.getLayer(layer).add(new StoryboardSample(fileRef, startTime, vol))
    return null
  }

  return null
}

/**
 * Parse raw storyboard text from an osu! `[Events]` section.
 * @example
 * import { parseStoryboard } from 'osu-files'
 *
 * const storyboard = parseStoryboard(storyboardSource)
 *
 * return {
 *   layers: storyboard.layers.size,
 *   drawable: storyboard.hasDrawable,
 * }
 */
export function parseStoryboard(rawText: string, formatVersion = 14): Storyboard {
  const sb = new Storyboard()
  sb._rawText = rawText
  sb._dirty = false

  const lines = rawText.split('\n')
  let currentElement: StoryboardSprite | null = null
  let currentGroup: StoryboardCommandGroup | null = null

  for (const raw of lines) {
    const depth = countDepth(raw)
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('//')) continue

    if (depth === 0) {
      currentGroup = null
      currentElement = parseElement(trimmed, sb, formatVersion)
      continue
    }

    if (!currentElement) continue

    const fields = splitFields(trimmed)
    const cmdType = fields[0].toUpperCase()

    if (cmdType === 'L') {
      const lg = new StoryboardLoopingGroup(toFloat(fields[2]), toInt(fields[3]) + 1)
      currentElement.loopingGroups.push(lg)
      currentGroup = lg
      continue
    }

    if (cmdType === 'T') {
      const tg = new StoryboardTriggerGroup(fields[1], toFloat(fields[2]), toFloat(fields[3]), -toInt(fields[4]))
      currentElement.triggerGroups.push(tg)
      currentGroup = tg
      continue
    }

    const target = currentGroup ?? currentElement.commands
    parseCommand(fields, target)
  }

  sb._dirty = false

  return sb
}

/**
 * Parse a full `.osb` file into a storyboard and its variable definitions.
 * @example
 * import { parseOsb } from 'osu-files'
 *
 * const parsed = parseOsb(osbSource)
 *
 * return {
 *   layers: parsed.storyboard.layers.size,
 *   variables: Object.keys(parsed.variables).length,
 * }
 */
export function parseOsb(content: string): { storyboard: Storyboard; variables: Record<string, string> } {
  const variables: Record<string, string> = {}
  let useSkinSprites = false
  let rawLines: string[] = []
  let section: string | null = null

  for (const raw of content.split(/\r?\n/)) {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('//')) continue

    const m = trimmed.match(/^\[(\w+)\]/)
    if (m) { section = m[1]; continue }

    if (section === 'Variables') {
      const vm = trimmed.match(/^\$(\w+)\s*=\s*(.+)$/)
      if (vm) variables[`$${vm[1]}`] = vm[2].trim()
    } else if (section === 'General') {
      const kv = trimmed.match(/^(.+?)\s*:\s*(.*)$/)
      if (kv && kv[1].trim().toLowerCase() === 'useskinsprites') {
        useSkinSprites = kv[2].trim() === '1' || kv[2].trim().toLowerCase() === 'true'
      }
    } else if (section === 'Events') {
      let line = raw
      while (line.includes('$')) {
        const previous = line
        for (const [k, v] of Object.entries(variables)) line = line.split(k).join(v)
        if (line === previous) break
      }
      rawLines.push(line)
    }
  }

  const sb = rawLines.length > 0 ? parseStoryboard(rawLines.join('\n')) : new Storyboard()
  sb.variables = variables
  sb.useSkinSprites = useSkinSprites
  sb._rawText = undefined
  sb._dirty = true

  return { storyboard: sb, variables }
}
