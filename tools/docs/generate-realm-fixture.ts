import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fixture = {
  source: 'tests/506483 Icon For Hire - Make A Move.osz',
  beatmaps: [{ osuText: '[General]\nAudioFilename: audio.mp3\n\n[Metadata]\nTitle: Fixture Map\nArtist: osu-files\nCreator: docs\nVersion: Normal\n\n[Difficulty]\nCircleSize: 4\nOverallDifficulty: 5\n' }],
  files: [{ filename: 'background.jpg', hash: 'a'.repeat(64) }],
}
const output = resolve(process.cwd(), 'docs/public/fixtures/realm-docs.json')
mkdirSync(resolve(process.cwd(), 'docs/public/fixtures'), { recursive: true })
writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`Wrote ${output}`)
