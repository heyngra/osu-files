import { Anchor, Easing, CommandType } from './types.js'
import {
  StoryboardCommandGroup, StoryboardCommand,
  StoryboardLoopingGroup, StoryboardTriggerGroup,
} from './commands.js'
import { StoryboardSprite, StoryboardAnimation, StoryboardSample } from './elements.js'
import { Storyboard } from './storyboard.js'
import type { StoryboardElement } from './layer.js'

const LAYER_ORDER = ['Video', 'Background', 'Fail', 'Pass', 'Foreground', 'Overlay']

function layerSortKey(name: string): number {
  const i = LAYER_ORDER.indexOf(name)
  return i >= 0 ? i : LAYER_ORDER.length + 1
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(15).replace(/\.?0+$/, '')
}

const anchorToIndex: Record<Anchor, number> = {
  [Anchor.TopLeft]: 0, [Anchor.Centre]: 1, [Anchor.CentreLeft]: 2,
  [Anchor.TopRight]: 3, [Anchor.BottomCentre]: 4, [Anchor.TopCentre]: 5,
  [Anchor.CentreRight]: 7, [Anchor.BottomLeft]: 8, [Anchor.BottomRight]: 9,
}

const layerToIndex: Record<string, string> = {
  Background: '0', Fail: '1', Pass: '2', Foreground: '3', Overlay: '4',
}

function writeCommandValue(cmd: StoryboardCommand<unknown>): string {
  const type = cmd.commandType
  const easing = cmd.easing
  const st = fmt(cmd.startTime)
  const et = cmd.endTime !== undefined ? fmt(cmd.endTime) : ''

  if (type === CommandType.Fade || type === CommandType.Scale || type === CommandType.Rotation) {
    const sv = cmd.startValue !== undefined ? fmt(cmd.startValue as number) : ''
    const ev = fmt(cmd.endValue as number)
    if (type === CommandType.Rotation) {
      const radians = (value: string) => fmt(Number(value) * Math.PI / 180)
      return sv
        ? `${type},${easing},${st},${et},${radians(sv)},${radians(ev)}`
        : `${type},${easing},${st},${et},${radians(ev)}`
    }
    return sv ? `${type},${easing},${st},${et},${sv},${ev}` : `${type},${easing},${st},${et},${ev}`
  }

  if (type === CommandType.MoveX || type === CommandType.MoveY) {
    const sv = cmd.startValue !== undefined ? fmt(cmd.startValue as number) : undefined
    const ev = fmt(cmd.endValue as number)
    return sv !== undefined
      ? `${type},${easing},${st},${et},${sv},${ev}`
      : `${type},${easing},${st},${et},${ev}`
  }

  if (type === CommandType.VectorScale) {
    const sv = cmd.startValue as { x: number; y: number } | undefined
    const ev = cmd.endValue as { x: number; y: number }
    return `${type},${easing},${st},${et},${fmt(sv?.x ?? 1)},${fmt(sv?.y ?? 1)},${fmt(ev.x)},${fmt(ev.y)}`
  }

  if (type === CommandType.Colour) {
    const sv = cmd.startValue as { r: number; g: number; b: number } | undefined
    const ev = cmd.endValue as { r: number; g: number; b: number }
    return `${type},${easing},${st},${et},${fmt(sv?.r ?? 255)},${fmt(sv?.g ?? 255)},${fmt(sv?.b ?? 255)},${fmt(ev.r)},${fmt(ev.g)},${fmt(ev.b)}`
  }

  if (type === CommandType.FlipH || type === CommandType.FlipV || type === CommandType.Blending) {
    const sub = (type as string).substring(2)
    const toValue = (value: unknown): string => type === CommandType.Blending
      ? value === 'Additive' ? '1' : '0'
      : value ? '1' : '0'
    const sv = cmd.startValue !== undefined ? toValue(cmd.startValue) : undefined
    const ev = cmd.endValue !== undefined ? toValue(cmd.endValue) : '0'
    const parts = [`P,${easing},${st},${et},${sub}`]
    if (sv !== undefined) parts.push(sv, ev)
    else parts.push(ev)
    return parts.join(',')
  }

  return ''
}

function writeCommands(group: StoryboardCommandGroup, indent: string): string[] {
  const lines: string[] = []
  for (const cmd of group.allCommands()) {
    const v = writeCommandValue(cmd)
    if (v) lines.push(indent + v)
  }
  return lines
}

function writeElement(el: StoryboardElement, layerName: string): string[] {
  const lines: string[] = []
  const layerIdx = layerToIndex[layerName] ?? layerName

  if (el instanceof StoryboardSprite) {
    const label = el instanceof StoryboardAnimation ? 'Animation' : 'Sprite'
    const originIdx = anchorToIndex[el.origin] ?? 1

    if (el instanceof StoryboardAnimation) {
      lines.push(`${label},${layerIdx},${originIdx},"${el.path}",${fmt(el.initialPosition.x)},${fmt(el.initialPosition.y)},${el.frameCount},${fmt(el.frameDelay)},${el.loopType}`)
    } else {
      lines.push(`${label},${layerIdx},${originIdx},"${el.path}",${fmt(el.initialPosition.x)},${fmt(el.initialPosition.y)}`)
    }

    lines.push(...writeCommands(el.commands, ' '))

    for (const lg of el.loopingGroups) {
      lines.push(` L,${fmt(lg.loopStartTime)},${lg.totalIterations - 1}`)
      lines.push(...writeCommands(lg, '  '))
    }

    for (const tg of el.triggerGroups) {
      const group = tg.groupNumber ? `,${-tg.groupNumber}` : ''
      lines.push(` T,${tg.triggerName},${fmt(tg.triggerStartTime)},${fmt(tg.triggerEndTime)}${group}`)
      lines.push(...writeCommands(tg, '  '))
    }
  }

  if (el instanceof StoryboardSample) {
    lines.push(`Sample,${fmt(el.startTime)},${layerIdx},"${el.path}",${el.volume}`)
  }

  return lines
}

function serializeElements(storyboard: Storyboard, source?: 'beatmap' | 'shared'): string {
  const lines: string[] = []
  const sorted = [...storyboard.layers.entries()].sort((a, b) => layerSortKey(a[0]) - layerSortKey(b[0]))

  for (const [name, layer] of sorted) {
    for (const el of layer.elements) {
      if (source && el.source !== source) continue
      lines.push(...writeElement(el, name))
    }
  }

  return lines.join('\n')
}

/** Serialize a Storyboard into text for the [Events] section. */
export function serializeStoryboard(storyboard: Storyboard): string {
  if (!storyboard._dirty && storyboard._rawText) return storyboard._rawText
  return serializeElements(storyboard)
}

/** Serialize only beatmap-source elements for embedding into .osu files. */
export function serializeStoryboardForOsu(storyboard: Storyboard): string {
  if (!storyboard._dirty && storyboard._rawText) return storyboard._rawText
  return serializeElements(storyboard, 'beatmap')
}

/** Serialize only shared-source elements for writing to .osb files. */
export function serializeStoryboardForOsb(storyboard: Storyboard): string {
  return serializeElements(storyboard, 'shared')
}

/** Serialize a Storyboard with variables into a full .osb file. */
export function serializeOsb(storyboard: Storyboard, variables: Record<string, string>): string {
  const sections: string[] = []

  if (storyboard.useSkinSprites) {
    sections.push('[General]', 'UseSkinSprites: 1', '')
  }

  const varEntries = Object.entries(variables)
  if (varEntries.length > 0) {
    sections.push('[Variables]')
    for (const [k, v] of varEntries) {
      sections.push(`${k}=${v}`)
    }
    sections.push('')
  }

  sections.push('[Events]')
  sections.push(serializeStoryboard(storyboard))

  return sections.join('\n')
}
