/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'collections',
  groupTitle: 'Collections',
  groupOrder: 20,
  groupSummary: 'Import, export, and edit the beatmap collections stored in Realm.',
  title: 'export-collection',
  order: 10,
  summary: 'Writes one collection, or all of them, to the legacy `collections.db` format.',
  api: ['init', 'OsuFilesAPI.collections'],
}
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

  /**
   * @docs
   * Open Realm in read-only mode.
   */
  /* @docs:start load-collections */
  const initialized = init(osuLazerRealmPath, { readOnly: true })
  /* @docs:end load-collections */

  try {
    /**
     * @docs
     * The collection module returns detached snapshots. Reading `.get` here loads every collection.
     */
    /* @docs:start read-collections */
    const all = initialized.collections.get
    /* @docs:end read-collections */

    if (all.length === 0) {
      console.log('No collections found.')
      return
    }

    console.log(`\nCollections (${all.length}):`)
    for (const c of all) {
      const count = c.BeatmapMD5Hashes.filter(h => h).length
      console.log(`  [${c.ID}] ${c.Name ?? '(unnamed)'} - ${count} beatmaps`)
    }

    const choice = (await rl.question('\nExport all or enter a collection name? (all / exact name): ')).trim()

    /**
     * @docs
     * Enter `all` to export every collection, or type an exact name to export one. Name lookup returns the first matching snapshot.
     */
    /* @docs:start choose-collection */
    let data
    if (choice.toLowerCase() === 'all') {
      data = initialized.collections.exportLegacy(all)
      console.log(`  Exporting all ${all.length} collections`)
    } else {
      const found = initialized.collections.get.byName(choice).first()
      if (!found) {
        console.log(`Collection '${choice}' not found.`)
        return
      }
      data = initialized.collections.exportLegacy(found)
      console.log(`  Exporting collection '${found.Name}' (${found.BeatmapMD5Hashes.filter(h => h).length} beatmaps)`)
    }
    /* @docs:end choose-collection */

    /**
     * @docs
     * `exportLegacy` returns a buffer in osu!stable's `collections.db` format. Write that buffer directly to the requested path.
     */
    /* @docs:start write-database */
    writeFileSync(outputPath, data)
    /* @docs:end write-database */
    console.log(`  Saved: ${outputPath} (${data.length} bytes)`)
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
