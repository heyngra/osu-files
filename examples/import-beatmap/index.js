/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'beatmaps',
  title: 'import-beatmap',
  order: 40,
  summary: 'Imports every `.osz` in a folder and deletes each archive after a successful import.',
  api: ['init', 'OsuFilesAPI.osz', 'BeatmapSetData'],
}
import { readdir, rm } from 'node:fs/promises'
import readline from 'node:readline/promises';
import { join, extname } from 'node:path'
import init from 'osu-files' 
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async () => {
  const osuLazerRealmPath = (await rl.question("What is the path of osu!lazer client.realm?")).replace(/^["']|["']$/g, '')
  const osuLazerFilesPath = (await rl.question("What is the path of osu!lazer files?")).replace(/^["']|["']$/g, '')
  const beatmapDir = (await rl.question("What is the path of the folder containing .osz files?")).replace(/^["']|["']$/g, '')
  
  const initialized = init(osuLazerRealmPath, {
    filesFolderPath: osuLazerFilesPath,
    checkHash: true,
  })

  try {
    /**
     * @docs
     * Read the chosen directory and keep only files with an `.osz` extension. `checkHash` makes the file store verify content before accepting it.
     */
    /* @docs:start find-archives */
    const allFiles = await readdir(beatmapDir)
    const oszFiles = allFiles.filter(f => extname(f).toLowerCase() === '.osz')
    /* @docs:end find-archives */
    for (const file of oszFiles) {
      const fullPath = join(beatmapDir, file)
      console.log(`Importing ${file}...`)
      try {
        /**
         * @docs
         * Import one archive at a time. A successful import returns the set ID and its beatmaps; only then does the example remove the original archive.
         */
        /* @docs:start import-archive */
        const result = await initialized.osz.import(fullPath)
        console.log(`  OK: setID=${result.onlineID} beatmaps=${result.beatmaps.length}`)
        await rm(fullPath)
        /* @docs:end import-archive */
      } catch (err) {
        console.error(`  FAIL: ${err instanceof Error ? err.message : err}`)
      }
    }
  } finally {
    rl.close()
    initialized.close()
    process.exit(0)
  }
})();
