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
    console.log(`\nImporting ${oskPath}...`)
    const result = await initialized.osk.import(oskPath)
    console.log(`  Name:    ${result.name}`)
    console.log(`  Creator: ${result.creator}`)
    console.log(`  ID:      ${result.id}`)
    console.log(`  Files:   ${result.files}`)
    console.log(`  Hash:    ${result.hash}`)
  } finally {
    initialized.close()
    rl.close()
    process.exit(0)
  }
})()
