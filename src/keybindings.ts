import Realm from 'realm'
import type { KeyBinding } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { KeyBindingQuery } from './get/keybindings.get.js'
import type { QuerySurface } from './get/base.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { registerDefaults as registerDefaultsImpl, type RegisterWrite } from './keybindings/register.js'
import type { KeyBindingDef, GlobalAction, RulesetAction, RulesetShortName } from './keybindings/types.js'
import {
  GLOBAL_DEFAULTS, OSU_DEFAULTS, TAIKO_DEFAULTS, CATCH_DEFAULTS,
  getManiaDefaults,
} from './keybindings/defaults.js'
import { resolveAction, validateKeyCombo } from './keybindings/keys.js'

/**
 * Creates the key binding sub-module with query and write operations.
 * @example
 * const kb = db.keybindings.get.byRulesetNameEquals('osu')[0]
 */
export function createKeyBindingModule(ctx: OsuFilesContext): KeyBindingModule {
  const q = new KeyBindingQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  const get = q.proxify()
  const write = createCrud<KeyBinding>(ctx, getConfig('KeyBinding')!)
  const registerWrite: RegisterWrite = {
    create: (data) => write.create({ ID: new Realm.BSON.UUID(), ...data }),
    delete: (id) => write.delete(id),
  }

  function getActionKeys<RR extends RulesetShortName | undefined | null>(
    rulesetName: RR,
    actionName: RR extends keyof typeof RulesetAction ? keyof (typeof RulesetAction)[RR] : RR extends undefined | null ? keyof typeof GlobalAction : string,
    variant = 0,
  ): string[] {
    const action = resolveAction(rulesetName ?? undefined, actionName)
    return [...get]
      .filter(k => k.RulesetName === (rulesetName ?? null) && k.Variant === variant && k.Action === action)
      .map(k => k.KeyCombination ?? 'None')
  }

  function setActionKeys<RR extends RulesetShortName | undefined | null>(
    rulesetName: RR,
    actionName: RR extends keyof typeof RulesetAction ? keyof (typeof RulesetAction)[RR] : RR extends undefined | null ? keyof typeof GlobalAction : string,
    keys: string[],
    variant = 0,
  ): void {
    const action = resolveAction(rulesetName ?? undefined, actionName)
    for (const k of keys) validateKeyCombo(k)

    for (const k of [...get].filter(k =>
      k.RulesetName === (rulesetName ?? null) && k.Variant === variant && k.Action === action,
    )) write.delete(k.ID)

    for (const key of keys)
      write.create({ ID: new Realm.BSON.UUID(), RulesetName: rulesetName || undefined, Variant: variant, Action: action, KeyCombination: key })
  }

  return {
    get,
    write,

    /**
     * Registers default keybindings for a ruleset.
     * @returns counts of inserted and removed bindings
     */
    registerDefaults(
      defaults: KeyBindingDef[],
      rulesetName?: RulesetShortName,
      variant?: number,
    ): { inserted: number; removed: number } {
      const existing = [...get]
      return registerDefaultsImpl(existing, defaults, registerWrite, rulesetName, variant)
    },

    /** Registers built-in defaults for every ruleset. */
    registerAllBuiltInDefaults(): { inserted: number; removed: number } {
      let inserted = 0
      let removed = 0
      const existing = [...get]

      const r = registerDefaultsImpl(existing, GLOBAL_DEFAULTS, registerWrite)
      inserted += r.inserted; removed += r.removed

      for (const [shortName, variantCount] of [
        ['osu', 1], ['taiko', 1], ['fruits', 1], ['mania', 10],
      ] as const) {
        for (let v = 0; v < variantCount; v++) {
          const defaults = shortName === 'mania' ? getManiaDefaults(v + 1)
            : shortName === 'osu' ? OSU_DEFAULTS
            : shortName === 'taiko' ? TAIKO_DEFAULTS
            : CATCH_DEFAULTS
          const r = registerDefaultsImpl(existing, defaults, registerWrite, shortName, v)
          inserted += r.inserted; removed += r.removed
        }
      }

      return { inserted, removed }
    },

    /** Returns keys assigned to an action. */
    getActionKeys,
    /** Replaces keys assigned to an action. */
    setActionKeys,
  }
}

/** Key binding sub-module with query and write operations. */
export type KeyBindingModule = {
  /** Queries readonly key-binding snapshots. */
  readonly get: QuerySurface<KeyBinding, KeyBindingQuery>
  /** Creates, updates, deletes, or upserts key bindings. */
  readonly write: Crud<KeyBinding>
  /** Registers default keybindings for a ruleset. */
  registerDefaults(defaults: KeyBindingDef[], rulesetName?: RulesetShortName, variant?: number): { inserted: number; removed: number }
  /** Registers built-in defaults for every ruleset. */
  registerAllBuiltInDefaults(): { inserted: number; removed: number }
  /** Returns keys assigned to an action. */
  getActionKeys<RR extends RulesetShortName | undefined | null>(
    rulesetName: RR,
    actionName: RR extends keyof typeof RulesetAction ? keyof (typeof RulesetAction)[RR] : RR extends undefined | null ? keyof typeof GlobalAction : string,
    variant?: number,
  ): string[]
  /** Replaces keys assigned to an action. */
  setActionKeys<RR extends RulesetShortName | undefined | null>(
    rulesetName: RR,
    actionName: RR extends keyof typeof RulesetAction ? keyof (typeof RulesetAction)[RR] : RR extends undefined | null ? keyof typeof GlobalAction : string,
    keys: string[],
    variant?: number,
  ): void
}
