import Realm from 'realm'
import { Schema } from './schema/index.js'
import { createBeatmapModule } from './beatmaps.js'
import { createScoreModule } from './scores.js'
import { createBeatmapSetModule } from './sets.js'
import { createCollectionModule } from './collections.js'
import { createRulesetModule } from './rulesets.js'
import { createSkinModule } from './skins.js'
import { createFileModule } from './files.js'
import { createKeyBindingModule } from './keybindings.js'
import { createModPresetModule } from './modpresets.js'

export * from './schema/index.js'

export function init(path: string, schemaVersion = 51) {
  const realm = new Realm({
    path,
    schema: Schema as Realm.ObjectSchema[],
    schemaVersion,
    readOnly: true,
  })

  return {
    close() { realm.close() },

    beatmaps: createBeatmapModule(realm),
    scores: createScoreModule(realm),
    sets: createBeatmapSetModule(realm),
    collections: createCollectionModule(realm),
    rulesets: createRulesetModule(realm),
    skins: createSkinModule(realm),
    files: createFileModule(realm),
    keybindings: createKeyBindingModule(realm),
    modpresets: createModPresetModule(realm),
  }
}
