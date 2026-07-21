/**
 * This example is a showcase of osz import.
 */
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

  const allFiles = await readdir(beatmapDir)
  const oszFiles = allFiles.filter(f => extname(f).toLowerCase() === '.osz')
  console.log(allFiles);
  for (const file of oszFiles) {
    const fullPath = join(beatmapDir, file)
    console.log(`Importing ${file}...`)
    try {
      const result = await initialized.osz.import(fullPath)
      console.log(`  OK: setID=${result.onlineID} beatmaps=${result.beatmaps.length}`)
      await rm(fullPath)
    } catch (err) {
      console.error(`  FAIL: ${err instanceof Error ? err.message : err}`)
    }
  }

  rl.close();
})();
