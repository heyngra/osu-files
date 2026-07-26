import readline from 'node:readline/promises'
import { writeFileSync } from 'node:fs'
import init from 'osu-files'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

;(async () => {
  const osuLazerRealmPath = (await rl.question('What is the path of osu!lazer client.realm? ')).replace(/^["']|["']$/g, '')
  const outputPath = (await rl.question('What is the output path for collections.db? ')).replace(/^["']|["']$/g, '')

  const initialized = init(osuLazerRealmPath, { readOnly: true })

  try {
    const all = initialized.collections.get

    if (all.length === 0) {
      console.log('No collections found.')
      return
    }

    console.log(`\nCollections (${all.length}):`)
    for (const c of all) {
      const count = c.BeatmapMD5Hashes.filter(h => h).length
      console.log(`  [${c.ID}] ${c.Name ?? '(unnamed)'} — ${count} beatmaps`)
    }

    const choice = (await rl.question('\nExport all or enter a collection name? (all / exact name): ')).trim()

    let data
    if (choice.toLowerCase() === 'all') {
      data = initialized.collections.exportLegacy(all)
      console.log(`  Exporting all ${all.length} collections`)
    } else {
      const found = initialized.collections.get.byNameEquals(choice)[0]
      if (!found) {
        console.log(`Collection '${choice}' not found.`)
        return
      }
      data = initialized.collections.exportLegacy(found)
      console.log(`  Exporting collection '${found.Name}' (${found.BeatmapMD5Hashes.filter(h => h).length} beatmaps)`)
    }

    writeFileSync(outputPath, data)
    console.log(`  Saved: ${outputPath} (${data.length} bytes)`)
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
