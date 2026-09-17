/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'beatmaps',
  groupTitle: 'Beatmaps',
  groupOrder: 10,
  groupSummary: 'Create, inspect, import, and export beatmaps and their storyboards.',
  title: 'create-storyboard',
  order: 10,
  summary: 'Builds a beatmap and storyboard from three images, then imports the finished set.',
  api: ['init', 'OsuFilesAPI.files', 'OsuFilesAPI.beatmap', 'OsuFilesAPI.sets', 'Storyboard', 'StoryboardSprite', 'StoryboardLoopingGroup', 'Anchor', 'Easing'],
}
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import init, { Storyboard, StoryboardSprite, Anchor, Easing } from 'osu-files'
import readline from 'node:readline/promises'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => rl.question(q).then(a => a.replace(/^["']|["']$/g, '').trim())
const sha256 = (content) => createHash('sha256').update(content).digest('hex')

;(async () => {
  const realmPath = await ask("osu!lazer client.realm: ")
  const filesPath = await ask("osu!lazer files folder: ")
  /**
   * @docs
   * Open the Realm together with its files folder. This example writes both database records and file content, so it does not use read-only mode.
   */
  /* @docs:start open-realm */
  const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
  /* @docs:end open-realm */

  try {
    const [bgPath, logoPath, spPath] = [
      await ask("\nBackground image: "),
      await ask("Logo image: "),
      await ask("Sparkle image: "),
    ]
    /**
     * @docs
     * Read the three images and put each buffer in the content-addressed file store. The returned hash is what the beatmap set keeps in Realm.
     */
    /* @docs:start store-images */
    const [bgBuf, logoBuf, spBuf] = [readFileSync(bgPath), readFileSync(logoPath), readFileSync(spPath)]
    const images = [
      { filename: bgPath.split(/[\\/]/).pop(), content: bgBuf, hash: osu.files.put(bgBuf).hash },
      { filename: logoPath.split(/[\\/]/).pop(), content: logoBuf, hash: osu.files.put(logoBuf).hash },
      { filename: spPath.split(/[\\/]/).pop(), content: spBuf, hash: osu.files.put(spBuf).hash },
    ]
    /* @docs:end store-images */

    /**
     * @docs
     * A storyboard is split into layers. Here, every sprite goes into the foreground layer. Commands can be chained, which keeps a short animation readable without hiding its timing.
     */
    /* @docs:start build-storyboard */
    const sb = new Storyboard()
    const fg = sb.getLayer("Foreground")
    const bg = new StoryboardSprite(images[0], Anchor.Centre, { x: 320, y: 240 })
    bg.addAlpha(Easing.None, 0, 8000, 1, 0).addScale(Easing.Out, 0, 1000, 1.1, 0.9)
    fg.add(bg)
    const logo = new StoryboardSprite(images[1], Anchor.Centre, { x: 320, y: -50 })
    logo.addAlpha(Easing.In, 500, 1500, 1, 0).addMoveY(Easing.Out, 1500, 3000, 240, -50)
    fg.add(logo)
    const sp = new StoryboardSprite(images[2], Anchor.Centre, { x: 100, y: 100 })
    const loop = sp.addLoopingGroup(2000, 5)
    loop.addAlpha(Easing.None, 0, 400, 0.8, 0).addScale(Easing.None, 0, 400, 1.5, 0.5)
    fg.add(sp)
    /* @docs:end build-storyboard */
    console.log(`\nStoryboard: ${fg.elements.length} sprites in Foreground`)

    const osuFile = 'storyboard-demo.osu'
    const beatmap = {
      fileFormat: 14,
      general: { audioFilename: 'dummy.mp3', audioLeadIn: 0, previewTime: -1, countdown: 0, sampleSet: 'normal', stackLeniency: 0.7, mode: 0, letterboxInBreaks: false, widescreenStoryboard: true },
      metadata: { title: 'Storyboard Demo', titleUnicode: 'Storyboard Demo', artist: 'osu-files', artistUnicode: 'osu-files', creator: 'osu-files', version: 'Storyboard Test', source: '', tags: ['storyboard','demo'], beatmapID: -1, beatmapSetID: -1 },
      difficulty: { hpDrainRate: 5, circleSize: 5, overallDifficulty: 5, approachRate: 5, sliderMultiplier: 1, sliderTickRate: 1 },
      events: [],
      storyboard: sb,
      timingPoints: [{ time: 0, beatLength: 500, meter: 4, sampleSet: 0, sampleIndex: 0, volume: 100, uninherited: true, effects: 0 }],
      colours: [],
      hitObjects: [
        { x: 256, y: 192, time: 1000, type: 5, hitSound: 0, isNewCombo: true, comboOffset: 0, objectType: 'circle' },
        { x: 256, y: 192, time: 60000, type: 1, hitSound: 0, isNewCombo: false, comboOffset: 0, objectType: 'circle' },
      ],
    }

    /**
     * @docs
     * Serialize the plain beatmap object back to `.osu` text, then store that text like any other file.
     */
    /* @docs:start serialize-beatmap */
    const osuContent = osu.beatmap.serialize(beatmap)
    const osuHash = osu.files.put(Buffer.from(osuContent)).hash
    /* @docs:end serialize-beatmap */

    const setHash = sha256(Buffer.from(osuContent))
    const allFiles = [{ hash: osuHash, filename: osuFile }, ...images.map(i => ({ hash: i.hash, filename: i.filename }))]

    /**
     * @docs
     * Register the set after all of its files have hashes. `importSet` writes the set, beatmap, and file references in one operation.
     */
    /* @docs:start import-set */
    const result = osu.sets.importSet({
      onlineID: -1,
      setHash,
      status: 0,
      protected: false,
      files: allFiles,
      beatmaps: [{
        filename: osuFile,
        hash: osuHash,
        md5Hash: createHash('md5').update(Buffer.from(osuContent)).digest('hex'),
        osuBeatmap: beatmap,
      }],
    })
    /* @docs:end import-set */

    console.log(`\nImported set with hash ${result.setHash}`)
    console.log(`Beatmap written to: files/${osuHash[0]}/${osuHash.substring(0, 2)}/${osuHash}`)

    const sets = osu.sets.get
    const createdSet = sets.find(s => s.Hash === setHash)
    if (createdSet) {
      console.log(`\nVerification: set found in realm with ID ${createdSet.ID}`)
      console.log(`Beatmaps in set: ${createdSet.Beatmaps?.length ?? 0}`)
      if (createdSet.Beatmaps?.length) {
        console.log(`Difficulty: ${createdSet.Beatmaps[0].DifficultyName}`)
        console.log(`Hash: ${createdSet.Beatmaps[0].Hash}`)
      }
      console.log(`Files: ${createdSet.Files?.length ?? 0}`)
    } else {
      console.log("\nWARNING: set not found in realm after import!")
    }

    console.log("\n--- Serialized .osu ---\n")
    console.log(osuContent)
  } catch (err) {
    console.error("\nERROR:", err?.message ?? err)
    console.error(err?.stack)
  } finally {
    rl.close(); osu.close(); process.exit(0)
  }
})()
