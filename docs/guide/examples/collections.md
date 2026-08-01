# Collections

Three examples work with the beatmap collections stored in the Realm database: 
- Exporting to the legacy `collections.db` format
- Importing that format
- Interactively managing collection membership.

All of them start with [`init()`](/api/generated/functions/init).

## export-collection

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/export-collection/index.js)

Exports one collection, or all of them, into the legacy `collections.db` format used by osu!stable.

```sh
cd examples/export-collection
npm install
npm start
```

The example opens the Realm read-only and lists every collection:

```ts
const initialized = init(osuLazerRealmPath, { readOnly: true })
const all = initialized.collections.get
```

[`OsuFilesAPI.collections`](/api/generated/type-aliases/OsuFilesAPI#collections) is the collection module; its `.get` returns detached snapshots. A single collection can be looked up by name:

```ts
const found = initialized.collections.get.byNameEquals(choice)[0]
```

Exporting produces the legacy binary:

```ts
const data = initialized.collections.exportLegacy(found)
writeFileSync(outputPath, data)
```

[`OsuFilesAPI.collections.exportLegacy`](/api/generated/type-aliases/OsuFilesAPI#collections) serializes a collection (or an array of collections) into a `collections.db` buffer.

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#collections`](/api/generated/type-aliases/OsuFilesAPI#collections)

## import-collection

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/import-collection/index.js)

Imports a legacy `collections.db` file into the Realm database.

```sh
cd examples/import-collection
npm install
npm start
```

Import merges rather than replaces, and reports how many collections were created vs. merged:

```ts
const { imported, merged } = initialized.collections.importLegacy(legacyDbPath)
console.log(`  Created: ${imported} new collections`)
console.log(`  Merged:  ${merged} existing collections`)
```

[`OsuFilesAPI.collections.importLegacy`](/api/generated/type-aliases/OsuFilesAPI#collections) parses the legacy database, matches collections by name, adds missing ones, and appends beatmap MD5 hashes to existing ones.

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#collections`](/api/generated/type-aliases/OsuFilesAPI#collections)

## manage-collection

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/manage-collection/index.js)

Interactive loop for adding or removing beatmaps in a collection by OnlineID or list index.

```sh
cd examples/manage-collection
npm install
npm start
```

Beatmaps are resolved by OnlineID so their MD5 can be added to the collection:

```ts
const beatmap = osu.beatmaps.get.byOnlineIdExact(onlineId)[0]
osu.collections.addBeatmap(String(col.ID), beatmap.MD5Hash)
```

[`OsuFilesAPI.beatmaps`](/api/generated/type-aliases/OsuFilesAPI#beatmaps) provides `byOnlineIdExact`; the MD5 hash is what collections actually store. Removal:

```ts
osu.collections.removeBeatmap(String(col.ID), md5)
```

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#collections`](/api/generated/type-aliases/OsuFilesAPI#collections) · [`OsuFilesAPI#beatmaps`](/api/generated/type-aliases/OsuFilesAPI#beatmaps)
