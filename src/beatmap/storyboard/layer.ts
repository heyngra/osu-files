import { StoryboardSprite, StoryboardAnimation, StoryboardSample } from './elements.js'
import type { Storyboard } from './storyboard.js'

export type StoryboardElement = StoryboardSprite | StoryboardAnimation | StoryboardSample

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

  get count(): number { return this.elements.length }

  _attach(sb: Storyboard): void {
    this.__sb = sb
    for (const el of this.elements) el._sb = sb
  }

  private _touch(): void { this.__sb?._markDirty() }

  add(el: StoryboardElement): void {
    this.elements.push(el)
    el._sb = this.__sb
    this._touch()
  }

  get(index: number): StoryboardElement | undefined { return this.elements[index] }

  remove(el: StoryboardElement): void {
    const idx = this.elements.indexOf(el)
    if (idx >= 0) {
      this.elements.splice(idx, 1)
      el._sb = undefined
      this._touch()
    }
  }

  removeAt(index: number): void {
    if (index >= 0 && index < this.elements.length) {
      const [el] = this.elements.splice(index, 1)
      el._sb = undefined
      this._touch()
    }
  }

  insertAt(index: number, el: StoryboardElement): void {
    this.elements.splice(index, 0, el)
    el._sb = this.__sb
    this._touch()
  }

  clear(): void {
    for (const el of this.elements) el._sb = undefined
    this.elements.length = 0
    this._touch()
  }

  moveUp(el: StoryboardElement): void {
    const idx = this.elements.indexOf(el)
    if (idx > 0) {
      this.elements.splice(idx, 1)
      this.elements.splice(idx - 1, 0, el)
      this._touch()
    }
  }

  moveDown(el: StoryboardElement): void {
    const idx = this.elements.indexOf(el)
    if (idx >= 0 && idx < this.elements.length - 1) {
      this.elements.splice(idx, 1)
      this.elements.splice(idx + 1, 0, el)
      this._touch()
    }
  }
}
