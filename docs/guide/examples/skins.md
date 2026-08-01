# Skins

Two examples work with `.osk` skin archives: importing a skin into the database and exporting a skin back to `.osk`.

Both start with [`init()`](/api/generated/functions/init).

## import-skin

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/import-skin/index.js)

Reads an `.osk` skin archive and imports it into the Realm database and file store.

```sh
cd examples/import-skin
npm install
npm start
```

Importing is made with a single call:

```ts
const result = await initialized.osk.import(oskPath)

console.log(`  Name:    ${result.name}`)
console.log(`  Creator: ${result.creator}`)
console.log(`  Files:   ${result.files}`)
console.log(`  Hash:    ${result.hash}`)
```

[`OsuFilesAPI.osk.import`](/api/generated/type-aliases/OsuFilesAPI#osk) unzips the archive, validates the `skin.ini`, writes every file into the content-addressed file store, and creates the skin, returning an [`ImportedSkinData`](/api/generated/type-aliases/ImportedSkinData) with the skin's identity and file count.

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#osk`](/api/generated/type-aliases/OsuFilesAPI#osk) · [`ImportedSkinData`](/api/generated/type-aliases/ImportedSkinData)

## export-random-skin

[Full source](https://github.com/heyngra/osu-files/blob/main/examples/export-random-skin/index.js)

Picks a random usable skin and exports it as an `.osk` archive.

```sh
cd examples/export-random-skin
npm install
npm start
```

Usable skins are queried first:

```ts
const skins = initialized.skins.get.usable()
const chosen = skins[Math.floor(Math.random() * skins.length)]
```

[`OsuFilesAPI.skins`](/api/generated/type-aliases/OsuFilesAPI#skins) exposes `.get.usable()` to filter out skins that cannot be resolved to files. 

Exporting writes the archive:

```ts
await initialized.osk.export(chosen.ID.toString(), outputPath)
```

[`OsuFilesAPI.osk.export`](/api/generated/type-aliases/OsuFilesAPI#osk) packs the skin's files from the file store into an `.osk` at the given path.

**API used:** [`init`](/api/generated/functions/init) · [`OsuFilesAPI#skins`](/api/generated/type-aliases/OsuFilesAPI#skins) · [`OsuFilesAPI#osk`](/api/generated/type-aliases/OsuFilesAPI#osk)
