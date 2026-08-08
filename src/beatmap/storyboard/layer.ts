import { StoryboardSprite, StoryboardAnimation, StoryboardSample } from './elements.js'
import type { Storyboard } from './storyboard.js'

export type StoryboardElement = StoryboardSprite | StoryboardAnimation | StoryboardSample

/** A named storyboard layer that owns drawable elements in render order. */
export class StoryboardLayer {
  name: string
  depth: number
  masking = false
  visibleWhenPassing = true
  visibleWhenFailing = true
  elements: StoryboardElement[] = []
  private __sb?: Storyboard

  constructor(name: string, depth: number) {
    this.name = name
    this.depth = depth
  }

  /** Number of elements currently in the layer. */
  get count(): number { return this.elements.length }

  /** @internal */
  _attach(sb: Storyboard): void {
    this.__sb = sb
    for (const el of this.elements) el._sb = sb
  }

  private _touch(): void { this.__sb?._markDirty() }

  /** Appends an element to the layer. */
  add(el: StoryboardElement): void {
    this.elements.push(el)
    el._sb = this.__sb
    this._touch()
  }

  /** Returns an element by its current index. */
  get(index: number): StoryboardElement | undefined { return this.elements[index] }

  /** Removes an element if it belongs to this layer. */
  remove(el: StoryboardElement): void {
    const idx = this.elements.indexOf(el)
    if (idx >= 0) {
      this.elements.splice(idx, 1)
      el._sb = undefined
      this._touch()
    }
  }

  /** Removes the element at an index. */
  removeAt(index: number): void {
    if (index >= 0 && index < this.elements.length) {
      const [el] = this.elements.splice(index, 1)
      el._sb = undefined
      this._touch()
    }
  }

  /** Inserts an element at an index. */
  insertAt(index: number, el: StoryboardElement): void {
    this.elements.splice(index, 0, el)
    el._sb = this.__sb
    this._touch()
  }

  /** Removes all elements from the layer. */
  clear(): void {
    for (const el of this.elements) el._sb = undefined
    this.elements.length = 0
    this._touch()
  }

  /** Moves an element one position toward the front of the layer. */
  moveUp(el: StoryboardElement): void {
    const idx = this.elements.indexOf(el)
    if (idx > 0) {
      this.elements.splice(idx, 1)
      this.elements.splice(idx - 1, 0, el)
      this._touch()
    }
  }

  /** Moves an element one position toward the back of the layer. */
  moveDown(el: StoryboardElement): void {
    const idx = this.elements.indexOf(el)
    if (idx >= 0 && idx < this.elements.length - 1) {
      this.elements.splice(idx, 1)
      this.elements.splice(idx + 1, 0, el)
      this._touch()
    }
  }
}
