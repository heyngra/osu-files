/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'skins',
  groupTitle: 'Skins',
  groupOrder: 40,
  groupSummary: 'Import `.osk` archives into Realm or pack installed skins back into archives.',
  title: 'import-skin',
  order: 10,
  summary: 'Imports an `.osk` archive into the Realm database and its file store.',
  api: ['init', 'OsuFilesAPI.osk', 'ImportedSkinData'],
}
import readline from 'node:readline/promises'
import init from 'osu-files'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

;(async () => {
  const osuLazerRealmPath = (await rl.question('What is the path of osu!lazer client.realm? ')).replace(/^["']|["']$/g, '')
  const osuLazerFilesPath = (await rl.question('What is the path of osu!lazer files? ')).replace(/^["']|["']$/g, '')
  const oskPath = (await rl.question('What is the path of the .osk file to import? ')).replace(/^["']|["']$/g, '')

  const initialized = init(osuLazerRealmPath, {
    filesFolderPath: osuLazerFilesPath,
  })

  try {
    /**
     * @docs
     * Import the archive in one call. The importer reads `skin.ini`, stores the archive's files, and creates the skin record in Realm.
     */
    /* @docs:start import-skin */
    console.log(`\nImporting ${oskPath}...`)
    const result = await initialized.osk.import(oskPath)
    console.log(`  Name:    ${result.name}`)
    console.log(`  Creator: ${result.creator}`)
    console.log(`  ID:      ${result.id}`)
    console.log(`  Files:   ${result.files}`)
    console.log(`  Hash:    ${result.hash}`)
    /* @docs:end import-skin */
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
