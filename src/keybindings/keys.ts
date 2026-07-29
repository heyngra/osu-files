import { GlobalAction, RulesetAction } from './types.js'

export enum InputKey {
  None = 'None',
  Shift = 'Shift',
  Control = 'Control',
  Alt = 'Alt',
  Space = 'Space',
  Enter = 'Enter',
  Escape = 'Escape',
  Tab = 'Tab',
  Tilde = 'Tilde',
  BackSpace = 'BackSpace',
  F1 = 'F1', F2 = 'F2', F3 = 'F3', F4 = 'F4', F5 = 'F5', F6 = 'F6',
  F7 = 'F7', F8 = 'F8', F9 = 'F9', F10 = 'F10', F11 = 'F11', F12 = 'F12',
  A = 'A', B = 'B', C = 'C', D = 'D', E = 'E', F = 'F', G = 'G', H = 'H',
  I = 'I', J = 'J', K = 'K', L = 'L', M = 'M', N = 'N', O = 'O', P = 'P',
  Q = 'Q', R = 'R', S = 'S', T = 'T', U = 'U', V = 'V', W = 'W', X = 'X', Y = 'Y', Z = 'Z',
  MouseLeft = 'MouseLeft',
  MouseRight = 'MouseRight',
  MouseMiddle = 'MouseMiddle',
  ExtraMouseButton1 = 'ExtraMouseButton1',
  ExtraMouseButton2 = 'ExtraMouseButton2',
  Left = 'Left', Right = 'Right', Up = 'Up', Down = 'Down',
  Comma = 'Comma', Period = 'Period', Semicolon = 'Semicolon',
  Plus = 'Plus', Minus = 'Minus', KeypadEnter = 'KeypadEnter',
  MouseWheelUp = 'MouseWheelUp', MouseWheelDown = 'MouseWheelDown',
  TrackPrevious = 'TrackPrevious', TrackNext = 'TrackNext', PlayPause = 'PlayPause',
}

const KEY_SET = new Set(Object.values(InputKey))

export function validateKeyCombo(combo: string): void {
  const parts = combo.split(' + ')
  for (const p of parts) {
    if (!KEY_SET.has(p as never))
      throw new Error(`Invalid key: '${p}' in '${combo}'`)
  }
}

import type { RulesetShortName } from './types.js'

export function resolveAction(rulesetName: RulesetShortName | undefined, actionName: string): number {
  if (rulesetName === undefined || rulesetName === null) {
    const v = (GlobalAction as Record<string, number | undefined>)[actionName]
    if (v === undefined) throw new Error(`Unknown global action '${actionName}'`)
    return v
  }
  const map = (RulesetAction as Record<string, Record<string, number> | undefined>)[rulesetName]
  if (!map) throw new Error(`Unknown ruleset '${rulesetName}'`)
  const v = map[actionName]
  if (v === undefined) throw new Error(`Unknown action '${actionName}' for ruleset '${rulesetName}'`)
  return v
}
