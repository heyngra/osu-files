/**
 * This example exports the most recently added beatmap set as an .osz file.
 */
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
  const outputDir = (await rl.question('What is the output directory for the .osz file? ')).replace(/^["']|["']$/g, '')

  const initialized = init(osuLazerRealmPath, {
    filesFolderPath: osuLazerFilesPath,
    readOnly: true,
  })

  try {
    const [newest] = initialized.sets.recent(1)
    if (!newest) {
      console.log('No beatmap sets found.')
      return
    }

    const metadata = newest.Beatmaps?.[0]?.Metadata
    const artist = metadata?.Artist ?? 'Unknown Artist'
    const title = metadata?.Title ?? 'Unknown Title'
    const setID = newest.OnlineID
    const filename = `${artist} - ${title} (${setID}).osz`
    const outputPath = join(outputDir, filename)

    console.log(`Exporting: ${artist} - ${title}`)
    console.log(`  setID=${setID} beatmaps=${newest.Beatmaps?.length ?? 0} date=${newest.DateAdded}`)
    await initialized.osz.export(newest.ID.toString(), outputPath)
    console.log(`  Saved to ${outputPath}`)
  } finally {
    initialized.close()
    rl.close()
  }
})()
