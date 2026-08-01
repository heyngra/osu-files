# Replays

Two examples work with `.osr` replay files: importing a replay into the database and exporting a stored score back to `.osr`.

Both start with [`init()`](/api/generated/functions/init).

## import-osr

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/import-osr/index.js)

Reads an `.osr` replay file, imports it into the Realm database, and prints the parsed replay metadata.

```sh
cd examples/import-osr
npm install
npm start
```

Importing is a single call:

```ts
const result = initialized.osr.import(replayPath)

console.log(`  Player: ${result.playerName}`)
console.log(`  Score:  ${result.totalScore.toLocaleString()}`)
console.log(`  Mods:   ${result.mods.valueOf()} (0x${result.mods.valueOf().toString(16)})`)
console.log(`  Frames: ${result.replayFrames.length}`)
```

[`OsuFilesAPI.osr.import`](/api/generated/type-aliases/OsuFilesAPI#osr) parses the replay, resolves its beatmap (matching by MD5 in the database), and writes the score. It returns the parsed replay metadata.
> [!NOTE]
> Importing osu! replays is a tedious process with a complicated score recalculation (for legacy scores). It should work in 99.9% cases, but if you find any issues with a wrong recalculation (excluding 1 score differences), then please submit an issue!
>
> [Legacy Conversion](https://github.com/heyngra/osu-files/blob/main/src/osr/legacy-conversion.ts) | [Import](https://github.com/heyngra/osu-files/blob/main/src/osr/import.ts)

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#osr`](/api/generated/type-aliases/OsuFilesAPI#osr)

## export-osr

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/export-osr/index.js)

Lists the ten most recent scores and exports a chosen one as an `.osr` file.

```sh
cd examples/export-osr
npm install
npm start
```

Recent scores are queried by date, then a score is picked by ID:

```ts
const recent = initialized.scores.get.sortedBy('Date').slice(0, 10)
const score = initialized.scores.get.byId(choice).first()
```

[`OsuFilesAPI.scores`](/api/generated/type-aliases/OsuFilesAPI#scores) returns detached read snapshots. The chosen score is serialized to disk:

```ts
initialized.osr.export(choice, outputPath)
```

[`OsuFilesAPI.osr.export`](/api/generated/type-aliases/OsuFilesAPI#osr) writes a score (by ID) to an `.osr` replay file.

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#scores`](/api/generated/type-aliases/OsuFilesAPI#scores) · [`OsuFilesAPI#osr`](/api/generated/type-aliases/OsuFilesAPI#osr)
