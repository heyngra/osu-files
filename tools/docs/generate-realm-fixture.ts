import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDocumentationDatabaseFixture } from '../../docs/.vitepress/runner/fixture-db.js'

const source = `[General]
AudioFilename: audio.mp3
Mode: 0

[Metadata]
Title: Make A Move
Artist: Icon For Hire
Creator: wajinshu
Version: Insane

[Difficulty]
CircleSize: 4
OverallDifficulty: 6
ApproachRate: 9
SliderMultiplier: 1.4
SliderTickRate: 1

[TimingPoints]
0,174

[HitObjects]
64,192,0,1,0,0:0:0:0:
128,192,500,1,0,0:0:0:0:
`

const storyboardSource = `Sprite,Foreground,Centre,"background.jpg",320,240
 F,0,0,1000,0,1
`

const osbSource = `[General]
UseSkinSprites: 1

[Variables]
$sprite = background.jpg

[Events]
Sprite,Foreground,Centre,"$sprite",320,240
 F,0,0,1000,0,1
`

const skinIniSource = `[General]
Name: Fixture Skin
Author: osu-files

[Colours]
Combo1: 255,255,255

[Fonts]
HitCirclePrefix: default
`

const fixture = {
  source,
  storyboardSource,
  osbSource,
  skinIniSource,
  beatmaps: [{ osuText: '[General]\nAudioFilename: audio.mp3\n\n[Metadata]\nTitle: Fixture Map\nArtist: osu-files\nCreator: docs\nVersion: Normal\n\n[Difficulty]\nCircleSize: 4\nOverallDifficulty: 5\n' }],
  files: [{ filename: 'background.jpg', hash: 'a'.repeat(64) }],
  database: createDocumentationDatabaseFixture(),
}
const output = resolve(process.cwd(), 'docs/public/fixtures/realm-docs.json')
mkdirSync(resolve(process.cwd(), 'docs/public/fixtures'), { recursive: true })
writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`Wrote ${output}`)
