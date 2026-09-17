import { StoryboardLayer } from './layer.js'
import { StoryboardSprite } from './elements.js'
import type { StoryboardLayerName } from './types.js'

const DEFAULT_DEPTHS: Record<string, number> = {
  Video: 4, Background: 3, Fail: 2, Pass: 1, Foreground: 0, Overlay: -2147483648,
}

/**
 * A mutable osu! storyboard containing layers, drawable elements, and timing commands.
 * Use {@link getLayer} to acquire layers, then add sprites, animations, or samples to them.
 * @example
 * import { Storyboard } from 'osu-files'
 *
 * const storyboard = new Storyboard()
 * const layer = storyboard.getLayer('Foreground')
 *
 * return { name: layer.name, depth: layer.depth }
 */
export class Storyboard {
  layers = new Map<string, StoryboardLayer>()
  variables: Record<string, string> = {}
  useSkinSprites = false
  backgroundOffset = { x: 0, y: 0 }

  /** @internal */
  _rawText?: string
  /** @internal */
  _dirty = false

  /** Returns an existing layer or creates it with the standard osu! depth. */
  getLayer(name: StoryboardLayerName): StoryboardLayer {
    let layer = this.layers.get(name)
    if (layer) return layer
    const depth = DEFAULT_DEPTHS[name] ?? this.layers.size
    layer = new StoryboardLayer(name, depth)
    layer._attach(this)
    this.layers.set(name, layer)
    return layer
  }

  /** Checks whether a named layer exists. */
  hasLayer(name: string): boolean { return this.layers.has(name) }

  /** Removes a layer by name or by object reference. */
  removeLayer(nameOrLayer: string | StoryboardLayer): void {
    if (typeof nameOrLayer === 'string') {
      if (this.layers.delete(nameOrLayer)) this._markDirty()
    } else {
      for (const [k, v] of this.layers) {
        if (v === nameOrLayer) { this.layers.delete(k); this._markDirty(); return }
      }
    }
  }

  /** Renames a layer while preserving its elements and depth. */
  renameLayer(oldName: string, newName: StoryboardLayerName): void {
    const layer = this.layers.get(oldName)
    if (!layer) return
    layer.name = newName
    this.layers.set(newName, layer)
    if (newName !== oldName) this.layers.delete(oldName)
    this._markDirty()
  }

  /** Removes every layer and its elements. */
  clearLayers(): void {
    if (this.layers.size > 0) {
      this.layers.clear()
      this._markDirty()
    }
  }

  /** Whether any layer contains a drawable storyboard element. */
  get hasDrawable(): boolean {
    for (const layer of this.layers.values()) {
      if (layer.elements.length > 0) return true
    }
    return false
  }

  /** The earliest command or element time, if the storyboard has events. */
  get earliestEventTime(): number | undefined {
    let t: number | undefined
    for (const layer of this.layers.values()) {
      for (const el of layer.elements) {
        const time = el.startTime
        if (time !== undefined && (t === undefined || time < t)) t = time
      }
    }
    return t
  }

  /** The latest command or element time, if the storyboard has events. */
  get latestEventTime(): number | undefined {
    let t: number | undefined
    for (const layer of this.layers.values()) {
      for (const el of layer.elements) {
        const time = el instanceof StoryboardSprite ? el.endTime : el.startTime
        if (time !== undefined && (t === undefined || time > t)) t = time
      }
    }
    return t
  }

  /** @internal */
  _markDirty(): void {
    this._dirty = true
  }
}
