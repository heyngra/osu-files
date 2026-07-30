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
    // Scores returned by queries are detached read snapshots, which is safe for export.
    const recent = initialized.scores.get.sortedBy('Date').slice(0, 10)
    if (recent.length === 0) {
      console.log('No scores found.')
      return
    }

    console.log('Recent plays:')
    for (const score of recent) {
      const date = score.Date instanceof Date ? score.Date.toISOString().slice(0, 19) : String(score.Date)
      const beatmap = score.BeatmapHash ?? '?'
      console.log(`  [${score.ID}] ${score.User?.Username ?? '?'} — ${date} — ${score.BeatmapInfo?.OnlineID ?? '?'} (${beatmap.slice(0, 8)}...)`)
    }

    const choice = (await rl.question('Enter the Score ID to export: ')).trim()
    const score = initialized.scores.get.byId(choice).first()
    if (!score) {
      console.log(`Score '${choice}' not found.`)
      return
    }

    const outputName = `${score.User?.Username ?? 'unknown'}-${score.Date instanceof Date ? score.Date.toISOString().slice(0, 10) : 'nodate'}.osr`.replace(/[<>:"/\\|?*]/g, '_')
    const outputPath = join(outputDir, outputName)
    initialized.osr.export(choice, outputPath)
    console.log(`  Saved: ${outputPath}`)
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
