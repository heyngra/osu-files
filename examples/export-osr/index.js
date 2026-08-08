/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'replays',
  title: 'export-osr',
  order: 20,
  summary: 'Lists the ten most recent scores and exports the one you choose as an `.osr` file.',
  api: ['init', 'OsuFilesAPI.scores', 'OsuFilesAPI.osr'],
}
import readline from 'node:readline/promises'
import { join } from 'node:path'
import init from 'osu-files'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

(async () => {
  const osuLazerRealmPath = (await rl.question('What is the path of osu!lazer client.realm? ')).replace(/^["']|["']$/g, '')
  const osuLazerFilesPath = (await rl.question('What is the path of osu!lazer files? ')).replace(/^["']|["']$/g, '')
  const outputDir = (await rl.question('What is the output directory for the .osr file? ')).replace(/^["']|["']$/g, '')

  const initialized = init(osuLazerRealmPath, {
    filesFolderPath: osuLazerFilesPath,
    readOnly: true,
  })

  try {
    /**
     * @docs
     * Sort scores by date and limit the query before printing them. These are detached snapshots, and exporting one does not change Realm.
     */
    /* @docs:start recent-scores */
    const recent = initialized.scores.get.sortedBy('Date').limit(10)
    if (recent.length === 0) {
      console.log('No scores found.')
      return
    }
    /* @docs:end recent-scores */

    console.log('Recent plays:')
    for (const score of recent) {
      const date = score.Date instanceof Date ? score.Date.toISOString().slice(0, 19) : String(score.Date)
      const beatmap = score.BeatmapHash ?? '?'
      console.log(`  [${score.ID}] ${score.User?.Username ?? '?'} - ${date} - ${score.BeatmapInfo?.OnlineID ?? '?'} (${beatmap.slice(0, 8)}...)`)
    }

    /**
     * @docs
     * Look up the chosen score by its Realm ID. The exporter accepts that same ID when it writes the `.osr` file.
     */
    /* @docs:start choose-score */
    const choice = (await rl.question('Enter the Score ID to export: ')).trim()
    const score = initialized.scores.get.byId(choice).first()
    if (!score) {
      console.log(`Score '${choice}' not found.`)
      return
    }
    /* @docs:end choose-score */

    const outputName = `${score.User?.Username ?? 'unknown'}-${score.Date instanceof Date ? score.Date.toISOString().slice(0, 10) : 'nodate'}.osr`.replace(/[<>:"/\\|?*]/g, '_')
    const outputPath = join(outputDir, outputName)
    /* @docs:start export-replay */
    initialized.osr.export(choice, outputPath)
    /* @docs:end export-replay */
    console.log(`  Saved: ${outputPath}`)
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
