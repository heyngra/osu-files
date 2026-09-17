import { Easing, CommandType, type Vec2, type Colour4, type BlendingMode } from './types.js'
import type { Storyboard } from './storyboard.js'

export abstract class StoryboardCommand<T> {
  easing: Easing
  startTime: number
  endTime?: number
  startValue?: T
  endValue: T

  constructor(easing: Easing, startTime: number, endTime: number | undefined, endValue: T, startValue?: T) {
    this.easing = easing
    this.startTime = startTime
    this.endTime = endTime
    this.startValue = startValue
    this.endValue = endValue
  }

  abstract get commandType(): CommandType
}

export class StoryboardAlphaCommand extends StoryboardCommand<number> {
  get commandType(): CommandType { return CommandType.Fade }
}
export class StoryboardXCommand extends StoryboardCommand<number> {
  get commandType(): CommandType { return CommandType.MoveX }
}
export class StoryboardYCommand extends StoryboardCommand<number> {
  get commandType(): CommandType { return CommandType.MoveY }
}
export class StoryboardScaleCommand extends StoryboardCommand<number> {
  get commandType(): CommandType { return CommandType.Scale }
}
export class StoryboardVectorScaleCommand extends StoryboardCommand<Vec2> {
  get commandType(): CommandType { return CommandType.VectorScale }
}
export class StoryboardRotationCommand extends StoryboardCommand<number> {
  get commandType(): CommandType { return CommandType.Rotation }
}
export class StoryboardColourCommand extends StoryboardCommand<Colour4> {
  get commandType(): CommandType { return CommandType.Colour }
}
export class StoryboardFlipHCommand extends StoryboardCommand<boolean> {
  get commandType(): CommandType { return CommandType.FlipH }
}
export class StoryboardFlipVCommand extends StoryboardCommand<boolean> {
  get commandType(): CommandType { return CommandType.FlipV }
}
export class StoryboardBlendingCommand extends StoryboardCommand<BlendingMode> {
  get commandType(): CommandType { return CommandType.Blending }
}

type FloatValues = { easing?: Easing; startTime?: number; endTime?: number; startValue?: number; endValue?: number }
type Vec2Values = { easing?: Easing; startTime?: number; endTime?: number; startValue?: Vec2; endValue?: Vec2 }
type ColourValues = { easing?: Easing; startTime?: number; endTime?: number; startValue?: Colour4; endValue?: Colour4 }
type BoolValues = { easing?: Easing; startTime?: number; endTime?: number; startValue?: boolean; endValue?: boolean }
type BlendingValues = { easing?: Easing; startTime?: number; endTime?: number; startValue?: BlendingMode; endValue?: BlendingMode }

export class StoryboardCommandGroup {
  private __sb?: Storyboard

  /** @internal */
  get _sb(): Storyboard | undefined { return this.__sb }
  /** @internal */
  set _sb(sb: Storyboard | undefined) { this.__sb = sb }

  alpha: StoryboardAlphaCommand[] = []
  x: StoryboardXCommand[] = []
  y: StoryboardYCommand[] = []
  scale: StoryboardScaleCommand[] = []
  vectorScale: StoryboardVectorScaleCommand[] = []
  rotation: StoryboardRotationCommand[] = []
  colour: StoryboardColourCommand[] = []
  flipH: StoryboardFlipHCommand[] = []
  flipV: StoryboardFlipVCommand[] = []
  blending: StoryboardBlendingCommand[] = []

  private _touch(): void { this._sb?._markDirty() }

  get startTime(): number | undefined {
    let t: number | undefined
    for (const cmd of this.allCommands()) {
      if (t === undefined || cmd.startTime < t) t = cmd.startTime
    }
    return t
  }

  get endTime(): number | undefined {
    let t: number | undefined
    for (const cmd of this.allCommands()) {
      const et = cmd.endTime ?? cmd.startTime
      if (t === undefined || et > t) t = et
    }
    return t
  }

  allCommands(): StoryboardCommand<unknown>[] {
    return [
      ...this.alpha, ...this.x, ...this.y, ...this.scale, ...this.vectorScale,
      ...this.rotation, ...this.colour, ...this.flipH, ...this.flipV, ...this.blending,
    ]
  }

  addAlpha(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this {
    this.alpha.push(new StoryboardAlphaCommand(easing, startTime, endTime, endValue ?? 1, startValue))
    return this
  }
  addX(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this {
    this.x.push(new StoryboardXCommand(easing, startTime, endTime, endValue ?? 0, startValue))
    return this
  }
  addY(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this {
    this.y.push(new StoryboardYCommand(easing, startTime, endTime, endValue ?? 0, startValue))
    return this
  }
  addScale(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this {
    this.scale.push(new StoryboardScaleCommand(easing, startTime, endTime, endValue ?? 1, startValue))
    return this
  }
  addVectorScale(easing: Easing, startTime: number, endTime?: number, endValue?: Vec2, startValue?: Vec2): this {
    this.vectorScale.push(new StoryboardVectorScaleCommand(easing, startTime, endTime, endValue ?? { x: 1, y: 1 }, startValue))
    return this
  }
  addRotation(easing: Easing, startTime: number, endTime?: number, endValue?: number, startValue?: number): this {
    this.rotation.push(new StoryboardRotationCommand(easing, startTime, endTime, endValue ?? 0, startValue))
    return this
  }
  addColour(easing: Easing, startTime: number, endTime?: number, endValue?: Colour4, startValue?: Colour4): this {
    this.colour.push(new StoryboardColourCommand(easing, startTime, endTime, endValue ?? { r: 255, g: 255, b: 255 }, startValue))
    return this
  }
  addFlipH(easing: Easing, startTime: number, endTime?: number, endValue?: boolean, startValue?: boolean): this {
    this.flipH.push(new StoryboardFlipHCommand(easing, startTime, endTime, endValue ?? false, startValue))
    return this
  }
  addFlipV(easing: Easing, startTime: number, endTime?: number, endValue?: boolean, startValue?: boolean): this {
    this.flipV.push(new StoryboardFlipVCommand(easing, startTime, endTime, endValue ?? false, startValue))
    return this
  }
  addBlending(easing: Easing, startTime: number, endTime?: number, endValue?: BlendingMode, startValue?: BlendingMode): this {
    this.blending.push(new StoryboardBlendingCommand(easing, startTime, endTime, endValue ?? 'Inherit', startValue))
    return this
  }

  removeAlpha(indexOrCmd: number | StoryboardAlphaCommand): void { this._remove(this.alpha, indexOrCmd) }
  removeX(indexOrCmd: number | StoryboardXCommand): void { this._remove(this.x, indexOrCmd) }
  removeY(indexOrCmd: number | StoryboardYCommand): void { this._remove(this.y, indexOrCmd) }
  removeScale(indexOrCmd: number | StoryboardScaleCommand): void { this._remove(this.scale, indexOrCmd) }
  removeVectorScale(indexOrCmd: number | StoryboardVectorScaleCommand): void { this._remove(this.vectorScale, indexOrCmd) }
  removeRotation(indexOrCmd: number | StoryboardRotationCommand): void { this._remove(this.rotation, indexOrCmd) }
  removeColour(indexOrCmd: number | StoryboardColourCommand): void { this._remove(this.colour, indexOrCmd) }
  removeFlipH(indexOrCmd: number | StoryboardFlipHCommand): void { this._remove(this.flipH, indexOrCmd) }
  removeFlipV(indexOrCmd: number | StoryboardFlipVCommand): void { this._remove(this.flipV, indexOrCmd) }
  removeBlending(indexOrCmd: number | StoryboardBlendingCommand): void { this._remove(this.blending, indexOrCmd) }

  clearAlpha(): void { this.alpha.length = 0; this._touch() }
  clearX(): void { this.x.length = 0; this._touch() }
  clearY(): void { this.y.length = 0; this._touch() }
  clearScale(): void { this.scale.length = 0; this._touch() }
  clearVectorScale(): void { this.vectorScale.length = 0; this._touch() }
  clearRotation(): void { this.rotation.length = 0; this._touch() }
  clearColour(): void { this.colour.length = 0; this._touch() }
  clearFlipH(): void { this.flipH.length = 0; this._touch() }
  clearFlipV(): void { this.flipV.length = 0; this._touch() }
  clearBlending(): void { this.blending.length = 0; this._touch() }

  setAlpha(index: number, v: FloatValues): void { this._set(this.alpha, index, v) }
  setX(index: number, v: FloatValues): void { this._set(this.x, index, v) }
  setY(index: number, v: FloatValues): void { this._set(this.y, index, v) }
  setScale(index: number, v: FloatValues): void { this._set(this.scale, index, v) }
  setVectorScale(index: number, v: Vec2Values): void { this._set(this.vectorScale, index, v) }
  setRotation(index: number, v: FloatValues): void { this._set(this.rotation, index, v) }
  setColour(index: number, v: ColourValues): void { this._set(this.colour, index, v) }
  setFlipH(index: number, v: BoolValues): void { this._set(this.flipH, index, v) }
  setFlipV(index: number, v: BoolValues): void { this._set(this.flipV, index, v) }
  setBlending(index: number, v: BlendingValues): void { this._set(this.blending, index, v) }

  private _remove<T>(arr: T[], indexOrCmd: number | T): void {
    if (typeof indexOrCmd === 'number') arr.splice(indexOrCmd, 1)
    else { const idx = arr.indexOf(indexOrCmd); if (idx >= 0) arr.splice(idx, 1) }
    this._touch()
  }

  private _set<T>(arr: T[], index: number, values: Partial<T>): void {
    const cmd = arr[index]
    if (!cmd) return
    Object.assign(cmd, values)
    this._touch()
  }

  removeCommand(cmd: StoryboardCommand<unknown>): void {
    for (const arr of this._allArrays()) {
      const idx = arr.indexOf(cmd)
      if (idx >= 0) { arr.splice(idx, 1); this._touch(); return }
    }
  }

  clearAll(): void {
    for (const arr of this._allArrays()) arr.length = 0
    this._touch()
  }

  shiftTimes(offsetMs: number): void {
    for (const cmd of this.allCommands()) {
      cmd.startTime += offsetMs
      if (cmd.endTime !== undefined) cmd.endTime += offsetMs
    }
    this._touch()
  }

  private _allArrays(): StoryboardCommand<unknown>[][] {
    return [this.alpha, this.x, this.y, this.scale, this.vectorScale, this.rotation, this.colour, this.flipH, this.flipV, this.blending]
  }

  /** Find the correct array for a command type.*/
  arrayFor(type: CommandType): StoryboardCommand<unknown>[] {
    const map: Record<CommandType, StoryboardCommand<unknown>[]> = {
      [CommandType.Fade]: this.alpha,
      [CommandType.MoveX]: this.x,
      [CommandType.MoveY]: this.y,
      [CommandType.Scale]: this.scale,
      [CommandType.VectorScale]: this.vectorScale,
      [CommandType.Rotation]: this.rotation,
      [CommandType.Colour]: this.colour,
      [CommandType.FlipH]: this.flipH,
      [CommandType.FlipV]: this.flipV,
      [CommandType.Blending]: this.blending,
    }
    return map[type]
  }
}

export class StoryboardLoopingGroup extends StoryboardCommandGroup {
  loopStartTime: number
  totalIterations: number

  constructor(loopStartTime: number, totalIterations: number) {
    super()
    this.loopStartTime = loopStartTime
    this.totalIterations = totalIterations
  }
}

export class StoryboardTriggerGroup extends StoryboardCommandGroup {
  triggerName: string
  triggerStartTime: number
  triggerEndTime: number
  groupNumber: number

  constructor(triggerName: string, triggerStartTime: number, triggerEndTime: number, groupNumber: number) {
    super()
    this.triggerName = triggerName
    this.triggerStartTime = triggerStartTime
    this.triggerEndTime = triggerEndTime
    this.groupNumber = groupNumber
  }
}
