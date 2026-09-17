/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'beatmaps',
  title: 'explore-storyboard',
  order: 20,
  summary: 'Opens a beatmap and lets you browse its storyboard one layer and element at a time.',
  api: ['init', 'OsuFilesAPI.sets', 'OsuFilesAPI.beatmap', 'OsuBeatmap', 'Storyboard', 'StoryboardLayer', 'StoryboardCommandGroup'],
}
import init from 'osu-files'
import readline from 'node:readline/promises'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => rl.question(q).then(a => a.replace(/^["']|["']$/g, '').trim())

const EASING = ["None","Out","In","InQuad","OutQuad","InOutQuad","InCubic","OutCubic",
  "InOutCubic","InQuart","OutQuart","InOutQuart","InQuint","OutQuint","InOutQuint",
  "InSine","OutSine","InOutSine","InExpo","OutExpo","InOutExpo","InCirc","OutCirc",
  "InOutCirc","InElastic","OutElastic","OutElasticHalf","OutElasticQuarter",
  "InOutElastic","InBack","OutBack","InOutBack","InBounce","OutBounce","InOutBounce",
  "InPow10","OutPow10","InOutPow10"]

const ANCHOR = ["TopLeft","TopCentre","TopRight","CentreLeft","Centre","CentreRight",
  "BottomLeft","BottomCentre","BottomRight"]

function cmd(c) {
  const et = c.endTime != null ? `-${c.endTime}` : '(inst)'
  const sv = c.startValue != null ? ` ${JSON.stringify(c.startValue)}→` : ' '
  return `${c.commandType} ${EASING[c.easing] ?? c.easing} ${c.startTime}${et}${sv}${JSON.stringify(c.endValue)}`
}

async function pick(items, label) {
  const list = items.map((entry, i) => {
    if (typeof entry === 'string') return { item: entry, label: entry }
    if (entry.item !== undefined) return entry
    return { item: entry, label: String(entry) }
  })
  while (true) {
    console.log(`\n${label}:`)
    for (let i = 0; i < list.length; i++) console.log(`  [${i}] ${list[i].label}`)
    const input = (await ask("\nIndex (or q): ")).toLowerCase()
    if (input === 'q') return null
    const idx = parseInt(input, 10)
    if (idx >= 0 && idx < list.length) return list[idx].item
  }
}

function showDetails(el) {
  console.log(`\nCommand details:`)
  if (el.commands) {
    for (const c of el.commands.allCommands()) console.log(`  ${cmd(c)}`)
    for (const g of el.loopingGroups) {
      console.log(`\n  Loop @${g.loopStartTime} x${g.totalIterations}:`)
      for (const c of g.allCommands()) console.log(`    ${cmd(c)}`)
    }
    for (const g of el.triggerGroups) {
      console.log(`\n  Trigger "${g.triggerName}" ${g.triggerStartTime}-${g.triggerEndTime}:`)
      for (const c of g.allCommands()) console.log(`    ${cmd(c)}`)
    }
  }
}

;(async () => {
  const realmPath = await ask("Path to osu!lazer client.realm: ")
  const filesPath = await ask("Path to osu!lazer files folder: ")
  const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })

  try {
    /**
     * @docs
     * Start with the available sets. The labels use the first beatmap's metadata so the picker shows an artist and title instead of a Realm ID.
     */
    /* @docs:start list-sets */
    const sets = osu.sets.get.map(s => ({
      item: s,
      label: `${s.Beatmaps?.[0]?.Metadata?.Artist} - ${s.Beatmaps?.[0]?.Metadata?.Title} (#${s.OnlineID})`
    }))
    /* @docs:end list-sets */

    const set = await pick(sets, "Beatmap sets")
    if (!set) return

    const diffs = set.Beatmaps.map(b => ({ item: b, label: b.DifficultyName }))
    const beatmap = await pick(diffs, "Difficulties")
    if (!beatmap) return

    /**
     * @docs
     * Realm only stores the beatmap record. `getFullData` also reads and parses the `.osu` file, which is where the storyboard lives.
     */
    /* @docs:start load-storyboard */
    const data = osu.beatmap.getFullData(String(beatmap.ID))
    if (!data?.storyboard) { console.log("No storyboard on this beatmap."); return }

    const sb = data.storyboard
    /* @docs:end load-storyboard */

    /**
     * @docs-note
     * Query results are detached, read-only snapshots. Use `osu.sets.open(id)` or `osu.beatmap.save(...)` when you need to keep an edit.
     */

    while (true) {
      /**
       * @docs
       * Each layer contains sprites, animations, and samples. Pick an element to print its commands, including commands nested in loops and triggers.
       */
      /* @docs:start inspect-layers */
      const layers = [...sb.layers.entries()].map(([name, layer]) => ({
        item: { name, layer },
        label: `${name} (${layer.elements.length} elements)`,
      }))
      const picked = await pick(layers, `Layers - ${beatmap.DifficultyName} (q=quit)`)
      /* @docs:end inspect-layers */
      if (!picked) return

      const { name, layer } = picked
      while (true) {
        const els = layer.elements.map(el => ({
          item: el,
          label: el.frameCount ? `Animation "${el.path}"` :
                 el.startTime != null && el.volume != null ? `Sample "${el.path}"` :
                 `Sprite "${el.path}" - ${ANCHOR[el.origin] ?? el.origin} (${el.initialPosition.x},${el.initialPosition.y})`
        }))
        const el = await pick(els, `Layer "${name}" (b=back, q=quit)`)
        if (!el) break

        showDetails(el)
      }
    }
  } finally {
    rl.close(); osu.close(); process.exit(0)
  }
})()
