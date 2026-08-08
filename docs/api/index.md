<script setup lang="ts">
import PromotableExample from '../.vitepress/components/PromotableExample.vue'

const workingWithResults = `const maps = db.beatmaps.get
  .byArtistContains('Icon For Hire')
  .limit(10)
  .map(map => map.Metadata?.Title)

const first = db.beatmaps.get
  .byOnlineId(506483)
  .first()

return { maps, first }`

const editingResults = `const session = db.beatmaps.get
  .byBpmAbove(180)
  .limit(1)
  .autoEdit()

for (const beatmap of session) beatmap.Hidden = true
session.commit()

return session.length`
</script>

# API Reference

The API reference is auto-generated from the public exports of `osu-files`.

Use the sidebar to browse by declaration category or search for a symbol, parameter, return type, or import path.

## Choose a module

Most database work starts at `db.<module>.get`:

- [Beatmaps](/api/facades/Beatmaps) - Find and edit beatmap snapshots.
- [Sets](/api/facades/Sets) - Find and edit beatmapsets and their files.
- [Scores](/api/facades/Scores) - Find and edit scores by player, date, or beatmap.
- [Collections](/api/facades/Collections) - Find and edit named beatmap collections.
- [Rulesets](/api/facades/Rulesets) - Find installed rulesets.
- [RulesetSettings](/api/facades/RulesetSettings) - Read settings for each ruleset.
- [Skins](/api/facades/Skins) - Find and edit built-in and user skins.
- [Files](/api/facades/Files) - Find file records by hash.
- [Keybindings](/api/facades/Keybindings) - Find and edit key bindings.
- [ModPresets](/api/facades/ModPresets) - Find saved mod presets.
- [Metadata](/api/facades/Metadata) - Search embedded beatmap metadata.

## Working with results

<PromotableExample
  id="api-working-with-results"
  execution="interactive-fixture"
  fixture="realm-docs"
  :code="workingWithResults"
>
```ts
const maps = db.beatmaps.get
  .byArtistContains('Icon For Hire')
  .limit(10)
  .map(map => map.Metadata?.Title)

const first = db.beatmaps.get
  .byOnlineId(506483)
  .first()

return { maps, first }
```
</PromotableExample>

## Editing results

Editing is part of the normal result-facade workflow. Use `write.update()` for one typed patch, or `autoEdit()` when several changes should be committed together.

<PromotableExample
  id="api-editing-results"
  execution="interactive-fixture"
  fixture="realm-docs"
  :code="editingResults"
>
```ts
const session = db.beatmaps.get
  .byBpmAbove(180)
  .limit(1)
  .autoEdit()

for (const beatmap of session) beatmap.Hidden = true
session.commit()

return session.length
```
</PromotableExample>

For lower-level access, see [Advanced APIs](/api/advanced).
