# Beatmaps

Four examples cover beatmaps: building a beatmap with a storyboard from scratch, exploring an existing storyboard, importing `.osz` archives, and exporting the newest set.

All of them start with [`init()`](/api/generated/functions/init), which opens the Realm database and returns the scoped module API.

## create-storyboard

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/create-storyboard/index.js)

Builds a `.osu` beatmap with a storyboard (background, logo, and sparkle sprites) from three image files, then imports it into the database.

```sh
cd examples/create-storyboard
npm install
npm start
```

It asks for the Realm path, the files folder, and the three image paths. Images are streamed into the content-addressed file store:

```ts
const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
const bg = { filename: 'bg.jpg', content: bgBuf, hash: osu.files.put(bgBuf).hash }
```

Next the storyboard is assembled with [`Storyboard`](/api/generated/classes/Storyboard), [`StoryboardSprite`](/api/generated/classes/StoryboardSprite), [`Anchor`](/api/generated/enumerations/Anchor), and [`Easing`](/api/generated/enumerations/Easing):

```ts
const sb = new Storyboard()
const fg = sb.getLayer('Foreground')
const bg = new StoryboardSprite(images[0], Anchor.Centre, { x: 320, y: 240 })
bg.addAlpha(Easing.None, 0, 8000, 1, 0).addScale(Easing.Out, 0, 1000, 1.1, 0.9)
fg.add(bg)
```

[`StoryboardSprite.addAlpha`](/api/generated/classes/StoryboardSprite#addalpha) and [`addScale`](/api/generated/classes/StoryboardSprite#addscale) are chainable, so several commands can be applied in one expression. The sparkle sprite animates inside a loop:

```ts
const loop = sp.addLoopingGroup(2000, 5)
loop.addAlpha(Easing.None, 0, 400, 0.8, 0)
    .addScale(Easing.None, 0, 400, 1.5, 0.5) // <-- chaining in action
```

[`addLoopingGroup`](/api/generated/classes/StoryboardSprite#addloopinggroup) returns a [`StoryboardLoopingGroup`](/api/generated/classes/StoryboardLoopingGroup) whose commands repeat every `2000` ms, `5` times. The completed storyboard is attached to a plain beatmap object and serialized:

```ts
const osuContent = osu.beatmap.serialize(beatmap)
const osuHash = osu.files.put(Buffer.from(osuContent)).hash
```

[`OsuFilesAPI.beatmap.serialize`](/api/generated/type-aliases/OsuFilesAPI#beatmap) turns the structured beatmap back into `.osu` file text, and the text is stored like any other file. Finally the set is registered:

```ts
const result = osu.sets.importSet(
  { 
    onlineID: -1, 
    setHash, 
    files: allFiles, 
    beatmaps: [...] // refer to source code for detailed content.
  }
)
```

[`OsuFilesAPI.sets`](/api/generated/type-aliases/OsuFilesAPI#sets) writes the set, its beatmaps, and file references into the Realm

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#files`](/api/generated/type-aliases/OsuFilesAPI#files) · [`OsuFilesAPI#beatmap`](/api/generated/type-aliases/OsuFilesAPI#beatmap) · [`OsuFilesAPI#sets`](/api/generated/type-aliases/OsuFilesAPI#sets) · [`Storyboard`](/api/generated/classes/Storyboard) · [`StoryboardSprite`](/api/generated/classes/StoryboardSprite) · [`StoryboardLoopingGroup`](/api/generated/classes/StoryboardLoopingGroup) · [`Anchor`](/api/generated/enumerations/Anchor) · [`Easing`](/api/generated/enumerations/Easing)

## explore-storyboard

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/explore-storyboard/index.js)

Interactive picker that walks a chosen beatmap set -> difficulty -> storyboard layer -> element, then prints every animation command on that element.

```sh
cd examples/explore-storyboard
npm install
npm start
```

Sets and difficulties are listed by querying [`OsuFilesAPI.sets`](/api/generated/type-aliases/OsuFilesAPI#sets):

```ts
const sets = osu.sets.get.map(s => ({
  item: s,
  label: `${s.Beatmaps?.[0]?.Metadata?.Artist} - ${s.Beatmaps?.[0]?.Metadata?.Title}`,
}))
```

The full beatmap (including its storyboard) is read and parsed from the files folder:

```ts
const data = osu.beatmap.getFullData(String(beatmap.ID))
const sb = data.storyboard
```

[`OsuFilesAPI.beatmap.getFullData`](/api/generated/type-aliases/OsuFilesAPI#beatmap) returns an [`OsuBeatmap`](/api/generated/type-aliases/OsuBeatmap) — the parsed `.osu` content plus a [`Storyboard`](/api/generated/classes/Storyboard). Storyboard inspection walks the layer map and per-element command groups:

```ts
const layers = [...sb.layers.entries()]
const layer = ... // picked layer
layer.elements.map(el => ...)
el.commands.allCommands().forEach(c => console.log(cmd(c)))
```

[`StoryboardLayer.elements`](/api/generated/classes/StoryboardLayer) holds the sprites/animations/samples, and [`StoryboardCommandGroup.allCommands`](/api/generated/classes/StoryboardCommandGroup#allcommands) flattens every command (fades, moves, scales, loops, triggers) into a list the example formats for display.

> [!NOTE]
> Query results are detached snapshots - this example only inspects them. Use [`osu.sets.open`](https://github.com/heyngra/osu-files/blob/main/src/sets.ts) or `osu.beatmap.save(...)` for persisted edits.

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#sets`](/api/generated/type-aliases/OsuFilesAPI#sets) · [`OsuFilesAPI#beatmap`](/api/generated/type-aliases/OsuFilesAPI#beatmap) · [`OsuBeatmap`](/api/generated/type-aliases/OsuBeatmap) · [`Storyboard`](/api/generated/classes/Storyboard) · [`StoryboardLayer`](/api/generated/classes/StoryboardLayer) · [`StoryboardCommandGroup`](/api/generated/classes/StoryboardCommandGroup)

## export-newest-osz

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/export-newest-osz/index.js)

Exports the most recently added beatmap set as an `.osz` archive.

```sh
cd examples/export-newest-osz
npm install
npm start
```

The newest set is found by sorting on `DateAdded`, then exported:

```ts
const newest = initialized.sets.get.sortedBy('DateAdded')[0]
await initialized.osz.export(newest.ID.toString(), outputPath)
```

[`OsuFilesAPI.sets`](/api/generated/type-aliases/OsuFilesAPI#sets) supports `sortedBy` on any query. [`OsuFilesAPI.osz.export`](/api/generated/type-aliases/OsuFilesAPI#osz) packs the set's beatmaps and referenced files into a `.osz` at the given path.

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#sets`](/api/generated/type-aliases/OsuFilesAPI#sets) · [`OsuFilesAPI#osz`](/api/generated/type-aliases/OsuFilesAPI#osz)

## import-beatmap

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/import-beatmap/index.js)

Batch-imports every `.osz` in a folder, deleting each archive once it imports cleanly.

```sh
cd examples/import-beatmap
npm install
npm start
```

Hashing is verified on write (`checkHash: true`), then each archive is imported:

```ts
const initialized = init(osuLazerRealmPath, { filesFolderPath, checkHash: true })
// ...
const result = await initialized.osz.import(fullPath)
console.log(`  OK: setID=${result.onlineID} beatmaps=${result.beatmaps.length}`)
```

[`OsuFilesAPI.osz.import`](/api/generated/type-aliases/OsuFilesAPI#osz) validates the archive, parses the beatmaps, writes their files into the file store, and creates the set — returning a [`BeatmapSetData`](/api/generated/type-aliases/BeatmapSetData).

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#osz`](/api/generated/type-aliases/OsuFilesAPI#osz) · [`BeatmapSetData`](/api/generated/type-aliases/BeatmapSetData)
