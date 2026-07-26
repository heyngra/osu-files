import readline from 'node:readline/promises'
import init from 'osu-files'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

;(async () => {
  const osuLazerRealmPath = (await rl.question('What is the path of osu!lazer client.realm? ')).replace(/^["']|["']$/g, '')
  const osuLazerFilesPath = (await rl.question('What is the path of osu!lazer files? ')).replace(/^["']|["']$/g, '')
  const replayPath = (await rl.question('What is the path of the .osr file? ')).replace(/^["']|["']$/g, '')

  const initialized = init(osuLazerRealmPath, {
    filesFolderPath: osuLazerFilesPath,
  })

  try {
    const result = initialized.osr.import(replayPath)

    console.log(`  Player: ${result.playerName}`)
    console.log(`  Score:  ${result.totalScore.toLocaleString()}`)
    console.log(`  Combo:  ${result.maxCombo}x`)
    console.log(`  Date:   ${result.timestamp.toISOString()}`)
    console.log(`  Mods:   ${result.mods.valueOf()} (0x${result.mods.valueOf().toString(16)})`)
    console.log(`  MD5:    ${result.replayMD5}`)
    console.log(`  Frames: ${result.replayFrames.length}`)
    console.log(`  Online ID: ${result.onlineScoreID}`)
    console.log('Done.')
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
