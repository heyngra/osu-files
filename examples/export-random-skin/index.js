/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'skins',
  title: 'export-random-skin',
  order: 20,
  summary: 'Picks an installed skin at random and exports it as an `.osk` archive.',
  api: ['init', 'OsuFilesAPI.skins', 'OsuFilesAPI.osk'],
}
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
    /**
     * @docs
     * Ask the skin query for usable entries. Built-in or incomplete skins may not have enough file data to export, so they are left out.
     */
    /* @docs:start choose-skin */
    const skins = initialized.skins.get.usable()
    if (skins.length === 0) {
      console.log('No usable skins found.')
      return
    }

    const chosen = skins[Math.floor(Math.random() * skins.length)]
    /* @docs:end choose-skin */
    const skinName = chosen.Name ?? 'Unnamed Skin'
    const filename = `${skinName.replace(/[<>:"/\\|?*]/g, '_')}.osk`
    const outputPath = join(outputDir, filename)

    console.log(`\nExporting: ${skinName}`)
    console.log(`  ID:      ${chosen.ID.toString()}`)
    console.log(`  Creator: ${chosen.Creator ?? 'Unknown'}`)
    console.log(`  Hash:    ${chosen.Hash ?? '(built-in)'}`)
    /**
     * @docs
     * Pass the skin's Realm ID to the exporter. It gathers the referenced files and writes them to an `.osk` archive.
     */
    /* @docs:start export-skin */
    await initialized.osk.export(chosen.ID.toString(), outputPath)
    /* @docs:end export-skin */
    console.log(`  Saved to ${outputPath}`)
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
