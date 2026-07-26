import type { KeyBindingDef } from './types.js'
import type { KeyBinding } from '../schema/types.js'

export type RegisterWrite = {
  create(data: Record<string, unknown>): KeyBinding
  delete(id: unknown): boolean
}

export function registerDefaults(
  existingBindings: KeyBinding[],
  defaults: KeyBindingDef[],
  write: RegisterWrite,
  rulesetName?: string,
  variant?: number,
): { inserted: number; removed: number } {
  let inserted = 0
  let removed = 0

  const byAction = new Map<number, KeyBindingDef[]>()
  for (const d of defaults) {
    const arr = byAction.get(d.action)
    if (arr) arr.push(d)
    else byAction.set(d.action, [d])
  }

  for (const [action, defaultsForAction] of byAction) {
    const existing = existingBindings.filter(k =>
      k.RulesetName === (rulesetName ?? undefined)
      && k.Variant === (variant ?? undefined)
      && k.Action === action,
    )

    const defaultsCount = defaultsForAction.length
    const existingCount = existing.length

    if (defaultsCount > existingCount) {
      for (const d of defaultsForAction.slice(existingCount)) {
        write.create({
          RulesetName: rulesetName ?? undefined,
          Variant: variant ?? undefined,
          Action: d.action,
          KeyCombination: d.keyCombination,
        })
        inserted++
      }
    } else if (defaultsCount < existingCount) {
      for (const k of existing.slice(defaultsCount)) {
        write.delete((k as KeyBinding).ID)
        removed++
        const idx = existingBindings.indexOf(k)
        if (idx >= 0) existingBindings.splice(idx, 1)
      }
    }
  }

  return { inserted, removed }
}
