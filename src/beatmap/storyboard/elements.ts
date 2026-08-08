import { Anchor, Easing, type StoryboardElementSource, type Vec2, LoopType, type TriggerName, type BlendingMode } from './types.js'
import type { FileRef } from '../../types.js'
import {
  StoryboardCommandGroup, StoryboardLoopingGroup, StoryboardTriggerGroup,
} from './commands.js'
import type { Storyboard } from './storyboard.js'

/** A drawable storyboard sprite backed by a file reference and command groups. */
export class StoryboardSprite {
  source: StoryboardElementSource = 'beatmap'
  file: FileRef
  origin: Anchor
  initialPosition: Vec2
  commands = new StoryboardCommandGroup()
  loopingGroups: StoryboardLoopingGroup[] = []
  triggerGroups: StoryboardTriggerGroup[] = []

  private __sb?: Storyboard
  /** @internal */
  get _sb(): Storyboard | undefined { return this.__sb }
  set _sb(sb: Storyboard | undefined) {
    this.__sb = sb
    this.commands._sb = sb
    for (const g of this.loopingGroups) g._sb = sb
    for (const g of this.triggerGroups) g._sb = sb
  }

  get path(): string { return this.file.filename }

  constructor(fileRef: FileRef, origin = Anchor.Centre, initialPosition?: Vec2, source?: StoryboardElementSource) {
    this.file = fileRef
    this.origin = origin
    this.initialPosition = initialPosition ?? { x: 320, y: 240 }
    if (source) this.source = source
  }

  private _touch(): void { this.__sb?._markDirty() }

  get startTime(): number | undefined { return this._earliest() }
  get endTime(): number | undefined { return this._latest() }

  private _earliest(): number | undefined {
    let t: number | undefined
    const check = (v: number | undefined) => { if (v !== undefined && (t === undefined || v < t)) t = v }
    check(this.commands.startTime)
    for (const g of this.loopingGroups) check(g.startTime)
    for (const g of this.triggerGroups) check(g.startTime)
    return t
  }

  private _latest(): number | undefined {
    let t: number | undefined
    const check = (v: number | undefined) => { if (v !== undefined && (t === undefined || v > t)) t = v }
    check(this.commands.endTime)
    for (const g of this.loopingGroups) check(g.endTime)
    for (const g of this.triggerGroups) check(g.endTime)
    return t
  }

  /** Adds a fade command and returns this sprite for chaining. */
  addAlpha(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this { this._touch(); this.commands.addAlpha(easing, startTime, endTime, endValue, startValue); return this }
  addMoveX(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this { this._touch(); this.commands.addX(easing, startTime, endTime, endValue, startValue); return this }
  addMoveY(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this { this._touch(); this.commands.addY(easing, startTime, endTime, endValue, startValue); return this }
  addScale(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this { this._touch(); this.commands.addScale(easing, startTime, endTime, endValue, startValue); return this }
  addVectorScale(easing: Easing, startTime: number, endTime?: number, endX?: number, endY?: number, startX?: number, startY?: number): this {
    this._touch()
    const endV = endX !== undefined && endY !== undefined ? { x: endX, y: endY } : undefined
    const startV = startX !== undefined && startY !== undefined ? { x: startX, y: startY } : undefined
    this.commands.addVectorScale(easing, startTime, endTime, endV, startV)
    return this
  }
  addRotation(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this { this._touch(); this.commands.addRotation(easing, startTime, endTime, endValue, startValue); return this }
  addColour(easing: Easing, startTime: number, endTime?: number, endR?: number, endG?: number, endB?: number, startR?: number, startG?: number, startB?: number): this {
    this._touch()
    const endV = endR !== undefined && endG !== undefined && endB !== undefined ? { r: endR, g: endG, b: endB } : undefined
    const startV = startR !== undefined && startG !== undefined && startB !== undefined ? { r: startR, g: startG, b: startB } : undefined
    this.commands.addColour(easing, startTime, endTime, endV, startV)
    return this
  }
  addFlipH(easing: Easing, startTime: number, endTime?: number, endValue?: boolean, startValue?: boolean): this { this._touch(); this.commands.addFlipH(easing, startTime, endTime, endValue, startValue); return this }
  addFlipV(easing: Easing, startTime: number, endTime?: number, endValue?: boolean, startValue?: boolean): this { this._touch(); this.commands.addFlipV(easing, startTime, endTime, endValue, startValue); return this }
  addBlending(easing: Easing, startTime: number, endTime?: number, endValue?: BlendingMode, startValue?: BlendingMode): this { this._touch(); this.commands.addBlending(easing, startTime, endTime, endValue, startValue); return this }

  addLoopingGroup(loopStartTime: number, totalIterations: number): StoryboardLoopingGroup {
    this._touch()
    const g = new StoryboardLoopingGroup(loopStartTime, totalIterations)
    g._sb = this.__sb
    this.loopingGroups.push(g)
    return g
  }

  addTriggerGroup(triggerName: TriggerName, triggerStartTime: number, triggerEndTime: number, groupNumber: number): StoryboardTriggerGroup {
    this._touch()
    const g = new StoryboardTriggerGroup(triggerName, triggerStartTime, triggerEndTime, groupNumber)
    g._sb = this.__sb
    this.triggerGroups.push(g)
    return g
  }

  removeLoopingGroup(indexOrGroup: number | StoryboardLoopingGroup): void {
    this._touch()
    if (typeof indexOrGroup === 'number') this.loopingGroups.splice(indexOrGroup, 1)
    else { const idx = this.loopingGroups.indexOf(indexOrGroup); if (idx >= 0) this.loopingGroups.splice(idx, 1) }
  }
  clearLoopingGroups(): void { this._touch(); this.loopingGroups.length = 0 }
  removeTriggerGroup(indexOrGroup: number | StoryboardTriggerGroup): void {
    this._touch()
    if (typeof indexOrGroup === 'number') this.triggerGroups.splice(indexOrGroup, 1)
    else { const idx = this.triggerGroups.indexOf(indexOrGroup); if (idx >= 0) this.triggerGroups.splice(idx, 1) }
  }
  clearTriggerGroups(): void { this._touch(); this.triggerGroups.length = 0 }

  clone(): this {
    const ctor = this.constructor as new (...args: unknown[]) => this
    const clone = new ctor(this.file, this.origin, { ...this.initialPosition }, this.source)

    for (const cmd of this.commands.allCommands()) {
      const copy = Object.assign(Object.create(Object.getPrototypeOf(cmd)), cmd)
      clone.commands.arrayFor(cmd.commandType).push(copy)
    }
    for (const lg of this.loopingGroups) {
      const clg = clone.addLoopingGroup(lg.loopStartTime, lg.totalIterations)
      for (const cmd of lg.allCommands()) {
        const copy = Object.assign(Object.create(Object.getPrototypeOf(cmd)), cmd)
        clg.arrayFor(cmd.commandType).push(copy)
      }
    }
    for (const tg of this.triggerGroups) {
      const ctg = clone.addTriggerGroup(tg.triggerName, tg.triggerStartTime, tg.triggerEndTime, tg.groupNumber)
      for (const cmd of tg.allCommands()) {
        const copy = Object.assign(Object.create(Object.getPrototypeOf(cmd)), cmd)
        ctg.arrayFor(cmd.commandType).push(copy)
      }
    }
    return clone
  }
}

/** A sprite that displays a sequence of numbered frames. */
export class StoryboardAnimation extends StoryboardSprite {
  frameCount: number
  frameDelay: number
  loopType: LoopType

  constructor(
    fileRef: FileRef,
    frameCount: number,
    frameDelay: number,
    origin = Anchor.Centre,
    initialPosition?: Vec2,
    loopType = LoopType.LoopForever,
    source?: StoryboardElementSource,
  ) {
    super(fileRef, origin, initialPosition, source)
    this.frameCount = frameCount
    this.frameDelay = frameDelay
    this.loopType = loopType
  }

  clone(): this {
    const c = super.clone() as StoryboardAnimation
    c.frameCount = this.frameCount
    c.frameDelay = this.frameDelay
    c.loopType = this.loopType
    return c as this
  }
}

/** An audio sample played at a fixed storyboard time. */
export class StoryboardSample {
  source: StoryboardElementSource = 'beatmap'
  file: FileRef
  startTime: number
  volume: number

  get path(): string { return this.file.filename }

  private __sb?: Storyboard
  /** @internal */
  get _sb(): Storyboard | undefined { return this.__sb }
  set _sb(sb: Storyboard | undefined) { this.__sb = sb }

  constructor(fileRef: FileRef, startTime: number, volume = 100, source?: StoryboardElementSource) {
    this.file = fileRef
    this.startTime = startTime
    this.volume = volume
    if (source) this.source = source
  }
}
