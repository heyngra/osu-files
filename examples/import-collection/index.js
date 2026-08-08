/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'collections',
  title: 'Import a collection database',
  order: 20,
  summary: 'Merges a legacy `collections.db` file into the collections already stored in Realm.',
  api: ['init', 'OsuFilesAPI.collections'],
}
import readline from 'node:readline/promises'
import init from 'osu-files'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

;(async () => {
  const osuLazerRealmPath = (await rl.question('What is the path of osu!lazer client.realm? ')).replace(/^["']|["']$/g, '')
  const osuLazerFilesPath = (await rl.question('What is the path of osu!lazer files? (optional, press Enter to skip) ')).replace(/^["']|["']$/g, '')
  const legacyDbPath = (await rl.question('What is the path of collections.db to import? ')).replace(/^["']|["']$/g, '')

  const initialized = init(osuLazerRealmPath, {
    ...(osuLazerFilesPath && { filesFolderPath: osuLazerFilesPath }),
  })

  try {
    /**
     * @docs
     * Import the legacy database in one call. Collections with new names are created; matching names receive any beatmap hashes they do not already contain.
     */
    /* @docs:start import-collections */
    console.log(`\nImporting ${legacyDbPath}...`)
    const { imported, merged } = initialized.collections.importLegacy(legacyDbPath)
    const total = initialized.collections.get.count()

    console.log(`  Created:  ${imported} new collections`)
    console.log(`  Merged:   ${merged} existing collections`)
    console.log(`  Total:    ${total} collections in database`)
    /* @docs:end import-collections */
    console.log('Done.')
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
