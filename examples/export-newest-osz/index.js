/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'beatmaps',
  title: 'export-newest-osz',
  order: 30,
  summary: 'Exports the most recently added beatmap set as an `.osz` archive.',
  api: ['init', 'OsuFilesAPI.sets', 'OsuFilesAPI.osz'],
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
  const outputDir = (await rl.question('What is the output directory for the .osz file? ')).replace(/^["']|["']$/g, '')

  const initialized = init(osuLazerRealmPath, {
    filesFolderPath: osuLazerFilesPath,
    readOnly: true,
  })

  try {
    /**
     * @docs
     * Sort the sets by `DateAdded` and take the first result. If Realm is empty, there is nothing to export.
     */
    /* @docs:start find-newest-set */
    const newest = initialized.sets.get.sortedBy('DateAdded').first()
    if (!newest) {
      console.log('No beatmap sets found.')
      return
    }
    /* @docs:end find-newest-set */

    const metadata = newest.Beatmaps?.[0]?.Metadata
    const artist = metadata?.Artist ?? 'Unknown Artist'
    const title = metadata?.Title ?? 'Unknown Title'
    const setID = newest.OnlineID
    const filename = `${artist} - ${title} (${setID}).osz`
    const outputPath = join(outputDir, filename)

    console.log(`Exporting: ${artist} - ${title}`)
    console.log(`  setID=${setID} beatmaps=${newest.Beatmaps?.length ?? 0} date=${newest.DateAdded}`)
    /**
     * @docs
     * Export by Realm ID. The exporter reads the beatmaps and their referenced files, then packs them into one `.osz` archive.
     */
    /* @docs:start export-set */
    await initialized.osz.export(newest.ID.toString(), outputPath)
    /* @docs:end export-set */
    console.log(`  Saved to ${outputPath}`)
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
