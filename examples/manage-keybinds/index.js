import readline from 'node:readline/promises'
import init, { InputKey, RulesetName, OSU_DEFAULTS } from 'osu-files'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

;(async () => {
  const realmPath = (await rl.question('Path to client.realm? ')).replace(/^["']|["']$/g, '')
  const osu = init(realmPath, { readOnly: false })

  try {
    const r = osu.keybindings.registerDefaults(OSU_DEFAULTS, RulesetName.Osu)
    console.log(`osu! defaults — inserted: ${r.inserted}, removed: ${r.removed}`)

    const keys = osu.keybindings.getActionKeys(RulesetName.Osu, 'LeftButton')
    console.log(`LeftButton: ${keys.join(', ')}`)

    osu.keybindings.setActionKeys(RulesetName.Osu, 'LeftButton', ['A', InputKey.MouseLeft])
    console.log(`After: ${osu.keybindings.getActionKeys(RulesetName.Osu, 'LeftButton').join(', ')}`)
  } finally {
    osu.close()
    rl.close()
    process.exit(0)
  }
})()
