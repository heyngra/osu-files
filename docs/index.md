<script setup>
import ApiCard from './.vitepress/components/ApiCard.vue'
import ExampleRunner from './.vitepress/components/ExampleRunner.vue'
</script>

# osu-files

`osu-files` reads and modifies osu!lazer Realm data and the file formats around it: `.osu`, `.osz`, `.osr`, `.osk`, storyboards, skins, and collections.

> [!CAUTION]
> This library allows essentialy unlimited access to osu!lazer's database. Caution is advised, as bugs might occur. Please be 100% sure your application works before sharing it with others.


## Quick start

```ts
import init from 'osu-files'

const db = init('./client.realm', {
  filesFolderPath: './files',
})

const maps = db.beatmaps.get.byOnlineIdExact(506483)
db.close()
```

See [Installation](/guide/installation) for setup.

## Quicklinks

<div class="api-grid">

<ApiCard name="Installation" kind="Guide" href="/guide/installation" signature="npm install osu-files" />
<ApiCard name="Complete reference" kind="API" href="/api/" signature="all public exports" />

</div>

## Example

This documentation features a live editor so you can preview the code on your own. Try it out!

<ExampleRunner id="home-parse-beatmap-metadata" title="Parse beatmap metadata" execution="interactive" fixture="realm-docs" :code="`import { parseOsu } from 'osu-files'\n\nconst metadata = parseOsu(beatmaps[0].osuText).metadata\n\nreturn metadata`" />

<style>
.api-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin: 1.5rem 0 2.5rem; }
@media (max-width: 640px) { .api-grid { grid-template-columns: 1fr; } }
</style>
