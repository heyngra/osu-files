import readline from 'node:readline/promises'
import { join } from 'node:path'
import init from 'osu-files'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

;(async () => {
  const osuLazerRealmPath = (await rl.question('What is the path of osu!lazer client.realm? ')).replace(/^["']|["']$/g, '')
  const osuLazerFilesPath = (await rl.question('What is the path of osu!lazer files? ')).replace(/^["']|["']$/g, '')
  const outputDir = (await rl.question('What is the output directory for the .osk? ')).replace(/^["']|["']$/g, '')

  const initialized = init(osuLazerRealmPath, {
    filesFolderPath: osuLazerFilesPath,
    readOnly: true,
  })

  try {
    const skins = initialized.skins.get.usable()
    if (skins.length === 0) {
      console.log('No usable skins found.')
      return
    }

    const chosen = skins[Math.floor(Math.random() * skins.length)]
    const skinName = chosen.Name ?? 'Unnamed Skin'
    const filename = `${skinName.replace(/[<>:"/\\|?*]/g, '_')}.osk`
    const outputPath = join(outputDir, filename)

    console.log(`\nExporting: ${skinName}`)
    console.log(`  ID:      ${chosen.ID.toString()}`)
    console.log(`  Creator: ${chosen.Creator ?? 'Unknown'}`)
    console.log(`  Hash:    ${chosen.Hash ?? '(built-in)'}`)
    await initialized.osk.export(chosen.ID.toString(), outputPath)
    console.log(`  Saved to ${outputPath}`)
  } finally {
    initialized.close()
    rl.close()
  }
})()
