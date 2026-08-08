/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'keybindings',
  groupTitle: 'Keybindings',
  groupOrder: 50,
  groupSummary: 'Register the osu! defaults, inspect an action, and replace its assigned keys.',
  title: 'manage-keybinds',
  order: 10,
  summary: 'Registers the default osu! bindings, prints one action, and remaps it.',
  api: ['init', 'OsuFilesAPI.keybindings', 'InputKey', 'RulesetName'],
}
import readline from 'node:readline/promises'
import init, { InputKey, RulesetName, OSU_DEFAULTS } from 'osu-files'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

;(async () => {
  const realmPath = (await rl.question('Path to client.realm? ')).replace(/^["']|["']$/g, '')
  const osu = init(realmPath, { readOnly: false })

  try {
    /**
     * @docs
     * Register the built-in osu! defaults first. The result reports how many bindings were inserted and how many obsolete defaults were removed.
     */
    /* @docs:start register-defaults */
    const r = osu.keybindings.registerDefaults(OSU_DEFAULTS, RulesetName.Osu)
    console.log(`osu! defaults - inserted: ${r.inserted}, removed: ${r.removed}`)
    /* @docs:end register-defaults */

    /**
     * @docs
     * Read the keys currently assigned to `LeftButton`, then replace them with the A key and the left mouse button. String key names and `InputKey` values can be mixed.
     */
    /* @docs:start remap-action */
    const keys = osu.keybindings.getActionKeys(RulesetName.Osu, 'LeftButton')
    console.log(`LeftButton: ${keys.join(', ')}`)

    osu.keybindings.setActionKeys(RulesetName.Osu, 'LeftButton', ['A', InputKey.MouseLeft])
    console.log(`After: ${osu.keybindings.getActionKeys(RulesetName.Osu, 'LeftButton').join(', ')}`)
    /* @docs:end remap-action */
  } finally {
    osu.close()
    rl.close()
    process.exit(0)
  }
})()
