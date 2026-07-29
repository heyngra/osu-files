import { StoryboardLayer } from './layer.js'
import { StoryboardSprite, StoryboardSample } from './elements.js'
import type { StoryboardLayerName } from './types.js'

const DEFAULT_DEPTHS: Record<string, number> = {
  Video: 4, Background: 3, Fail: 2, Pass: 1, Foreground: 0, Overlay: -2147483648,
}

export class Storyboard {
  layers = new Map<string, StoryboardLayer>()
  variables: Record<string, string> = {}
  useSkinSprites = false
  backgroundOffset = { x: 0, y: 0 }

  _rawText?: string
  _dirty = false

  getLayer(name: StoryboardLayerName): StoryboardLayer {
    let layer = this.layers.get(name)
    if (layer) return layer
    const depth = DEFAULT_DEPTHS[name] ?? this.layers.size
    layer = new StoryboardLayer(name, depth)
    layer._attach(this)
    this.layers.set(name, layer)
    return layer
  }

  hasLayer(name: string): boolean { return this.layers.has(name) }

  removeLayer(nameOrLayer: string | StoryboardLayer): void {
    if (typeof nameOrLayer === 'string') {
      if (this.layers.delete(nameOrLayer)) this._markDirty()
    } else {
      for (const [k, v] of this.layers) {
        if (v === nameOrLayer) { this.layers.delete(k); this._markDirty(); return }
      }
    }
  }

  renameLayer(oldName: string, newName: StoryboardLayerName): void {
    const layer = this.layers.get(oldName)
    if (!layer) return
    layer.name = newName
    this.layers.set(newName, layer)
    if (newName !== oldName) this.layers.delete(oldName)
    this._markDirty()
  }

  clearLayers(): void {
    if (this.layers.size > 0) {
      this.layers.clear()
      this._markDirty()
    }
  }

  get hasDrawable(): boolean {
    for (const layer of this.layers.values()) {
      if (layer.elements.length > 0) return true
    }
    return false
  }

  get earliestEventTime(): number | undefined {
    let t: number | undefined
    for (const layer of this.layers.values()) {
      for (const el of layer.elements) {
        if (el instanceof StoryboardSprite) {
          const st = el.commands.startTime
          if (st !== undefined && (t === undefined || st < t)) t = st
          for (const g of el.loopingGroups) { const gt = g.startTime; if (gt !== undefined && (t === undefined || gt < t)) t = gt }
          for (const g of el.triggerGroups) { const gt = g.startTime; if (gt !== undefined && (t === undefined || gt < t)) t = gt }
        }
        if (el instanceof StoryboardSample) {
          if (t === undefined || el.startTime < t) t = el.startTime
        }
      }
    }
    return t
  }

  get latestEventTime(): number | undefined {
    let t: number | undefined
    for (const layer of this.layers.values()) {
      for (const el of layer.elements) {
        if (el instanceof StoryboardSprite) {
          const et = el.commands.endTime
          if (et !== undefined && (t === undefined || et > t)) t = et
          for (const g of el.loopingGroups) { const gend = g.endTime; if (gend !== undefined && (t === undefined || gend > t)) t = gend }
          for (const g of el.triggerGroups) { const gend = g.endTime; if (gend !== undefined && (t === undefined || gend > t)) t = gend }
        }
        if (el instanceof StoryboardSample && (t === undefined || el.startTime > t)) t = el.startTime
      }
    }
    return t
  }

  _markDirty(): void {
    this._dirty = true
  }
}
