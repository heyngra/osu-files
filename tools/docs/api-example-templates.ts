type Reflection = {
  name: string
  kind: number
  children?: Reflection[]
  signatures?: Array<{ parameters?: Array<{ name: string }>; type?: unknown }>
}

const importLine = (names: string[]) => `import { ${names.join(', ')} } from 'osu-files'`
const fileRef = `const file = new FileRef('background.jpg', { hash: 'a'.repeat(64) })`
const storyboardSetup = `${importLine(['FileRef', 'Storyboard', 'StoryboardSprite', 'Easing'])}

const storyboard = new Storyboard()
const sprite = new StoryboardSprite(
  new FileRef('background.jpg', { hash: 'a'.repeat(64) }),
)
storyboard.getLayer('Foreground').add(sprite)`
const commandSetup = `${importLine(['CommandType', 'Easing', 'StoryboardCommandGroup'])}

const commands = new StoryboardCommandGroup()
commands.addAlpha(Easing.Out, 0, 1000, 1, 0)`

function functionExample(name: string): string | undefined {
  const examples: Record<string, string> = {
    cloneSkinIni: `${importLine(['cloneSkinIni', 'parseSkinIni'])}

const document = parseSkinIni(skinIniSource)
const copy = cloneSkinIni(document)

return copy.general.name`,
    computeSkinHash: `import { computeSkinHash } from 'osu-files'

const hash = computeSkinHash([
  { filename: 'skin.ini', content: Buffer.from(skinIniSource) },
])

return hash`,
    createFileRef: `${importLine(['createFileRef'])}

const file = createFileRef('audio.mp3', { hash: 'a'.repeat(64) })

return { filename: file.filename, hash: file.hash }`,
    fullSkinContentHash: `import { fullSkinContentHash } from 'osu-files'

const context = {} as Parameters<typeof fullSkinContentHash>[0]
const skin = {} as Parameters<typeof fullSkinContentHash>[1]
const hash = fullSkinContentHash(context, skin)

return hash`,
    getManiaDefaults: `${importLine(['getManiaDefaults'])}

return getManiaDefaults(4).slice(0, 4)`,
    hasFilesFolder: `${importLine(['hasFilesFolder'])}

return hasFilesFolder({ filesFolderPath: './files' })`,
    init: `import init from 'osu-files'

const db = init('./client.realm', { filesFolderPath: './files' })
const count = db.beatmaps.get.count()
db.close()

return count`,
    parseOsb: `${importLine(['parseOsb'])}

const parsed = parseOsb(osbSource)

return {
  layers: parsed.storyboard.layers.size,
  variables: Object.keys(parsed.variables).length,
}`, 
    parseOsu: `${importLine(['parseOsu'])}

const beatmap = parseOsu(source)

return {
  title: beatmap.metadata.title,
  objects: beatmap.hitObjects.length,
}`,
    parseSkinIni: `${importLine(['parseSkinIni'])}

const document = parseSkinIni(skinIniSource)

return {
  name: document.general.name,
  issues: document.issues.length,
}`,
    parseStoryboard: `${importLine(['parseStoryboard'])}

const storyboard = parseStoryboard(storyboardSource)

return {
  layers: storyboard.layers.size,
  drawable: storyboard.hasDrawable,
}`,
    serializeOsb: `${importLine(['parseOsb', 'serializeOsb'])}

const parsed = parseOsb(osbSource)

return serializeOsb(parsed.storyboard, parsed.variables)`,
    serializeOsu: `${importLine(['parseOsu', 'serializeOsu'])}

const beatmap = parseOsu(source)

return serializeOsu(beatmap)`,
    serializeSkinIni: `${importLine(['parseSkinIni', 'serializeSkinIni'])}

const document = parseSkinIni(skinIniSource)

return serializeSkinIni(document)`,
    serializeStoryboard: `${importLine(['parseStoryboard', 'serializeStoryboard'])}

const storyboard = parseStoryboard(storyboardSource)

return serializeStoryboard(storyboard)`,
  }
  return examples[name]
}

function classExample(name: string): string | undefined {
  if (name === 'Storyboard') return `${importLine(['Storyboard'])}

const storyboard = new Storyboard()
const layer = storyboard.getLayer('Foreground')

return { name: layer.name, depth: layer.depth }`
  if (name === 'FileRef') return `${importLine(['FileRef'])}

const file = new FileRef('background.jpg', { hash: 'a'.repeat(64) })

return { filename: file.filename, hash: file.hash }`
  if (name === 'StoryboardLayer') return `${importLine(['StoryboardLayer'])}

const layer = new StoryboardLayer('Foreground', 0)

return { name: layer.name, depth: layer.depth, count: layer.count }`
  if (name === 'StoryboardSprite') return `${storyboardSetup}

sprite.addScale(Easing.Out, 0, 1000, 1.1)

return { path: sprite.path, commands: sprite.commands.allCommands().length }`
  if (name === 'StoryboardAnimation') return `${importLine(['FileRef', 'StoryboardAnimation', 'LoopType'])}

const animation = new StoryboardAnimation(
  new FileRef('animation.png', { hash: 'a'.repeat(64) }),
  4,
  80,
  undefined,
  undefined,
  LoopType.LoopForever,
)

return { path: animation.path, frames: animation.frameCount }`
  if (name === 'StoryboardSample') return `${importLine(['FileRef', 'StoryboardSample'])}

const sample = new StoryboardSample(
  new FileRef('audio.mp3', { hash: 'a'.repeat(64) }),
  500,
)

return { path: sample.path, startTime: sample.startTime }`
  if (['StoryboardCommandGroup', 'StoryboardLoopingGroup', 'StoryboardTriggerGroup'].includes(name)) return `${commandSetup}

return commands.allCommands().map(command => command.commandType)`
  if (name.endsWith('Command')) return `${importLine(['Easing', name])}

const command = new ${name}(Easing.None, 0, 500, ${name.includes('Colour') ? '{ r: 255, g: 255, b: 255 }' : name.includes('VectorScale') ? '{ x: 1, y: 1 }' : name.includes('Flip') ? 'false' : name.includes('Blending') ? "'Inherit'" : '1'})

return command.commandType`
  if (name === 'EditSession') return `const session = db.beatmaps.get.limit(1).autoEdit()
const length = session.length
session.rollback()

return length`
  if (name === 'RealmClosedError' || name === 'RealmReadOnlyError') return `import { ${name} } from 'osu-files'

const error = new ${name}()

return { name: error.name, message: error.message }`
  if (name === 'FileStore') return `import { FileStore } from 'osu-files'

const store = new FileStore('./files', true)

return store.recoveryBasePath()`
  if (name === 'RealmSession') return `import type { RealmSession } from 'osu-files'

const session = {} as RealmSession

return session.isOpen`
  if (name === 'RollbackEntry') return `import type { RollbackEntry } from 'osu-files'

const entry = {} as RollbackEntry

return entry`
  if (name === 'RollbackLogger') return `import type { RollbackLogger } from 'osu-files'

const logger = {} as RollbackLogger

return logger.entries.length`
  return undefined
}

function fileStoreMemberExample(member: string): string | undefined {
  const setup = `${importLine(['FileStore'])}

const store = new FileStore('./files')`
  const stored = `${setup}
const stored = store.put(Buffer.from('data'))`

  const examples: Record<string, string> = {
    path: `${setup}

return store.path('a'.repeat(64))`,
    recoveryBasePath: `${setup}

return store.recoveryBasePath()`,
    put: `${stored}

return { hash: stored.hash, created: stored.created }`,
    putFile: `${setup}
const hash = 'a'.repeat(64)
const temporary = store.temporaryPath(hash)

return store.putFile(temporary, hash)`,
    beginTransaction: `${setup}
const transaction = store.beginTransaction()

transaction.rollback()

return transaction`,
    read: `${stored}
const content = store.read(stored.hash)

return content.length`,
    verify: `${stored}

return store.verify(stored.hash)`,
    hasPath: `${stored}

return store.hasPath(stored.hash)`,
    remove: `${stored}

return store.remove(stored.hash)`,
    promote: `${setup}
const hash = 'a'.repeat(64)
const temporary = store.temporaryPath(hash)

return store.promote(temporary, hash)`,
    temporaryPath: `${setup}

return store.temporaryPath('a'.repeat(64))`,
  }
  return examples[member]
}

function enumExample(reflection: Reflection): string {
  const member = reflection.children?.find(child => child.name && child.kind === 16)?.name ?? reflection.children?.[0]?.name ?? 'Unknown'
  return `${importLine([reflection.name])}

return ${reflection.name}.${member}`
}

function interfaceExample(name: string): string | undefined {
  const modules: Record<string, string> = {
    BeatmapModule: `const title = db.beatmaps.get.first()?.Metadata?.Title
return title`,
    BeatmapSetModule: `return db.sets.get.first()?.OnlineID`,
    FileModule: `return db.files.get.first()?.Hash`,
    ScoreModule: `return db.scores.get.first()?.PP`,
    SkinModule: `return db.skins.get.first()?.Name`,
  }
  return modules[name]
}

function typeExample(name: string): string | undefined {
  const producerExamples: Record<string, string> = {
    Beatmap: `const beatmap = db.beatmaps.get.first()
return beatmap?.Metadata?.Title`,
    BeatmapCollection: `const collection = db.collections.get.first()
return collection?.Name`,
    BeatmapDifficulty: `const difficulty = db.beatmaps.get.first()?.Difficulty
return difficulty?.ApproachRate`,
    BeatmapMetadata: `const metadata = db.metadata.get.first()
return metadata?.Title`,
    BeatmapMetadataSnapshot: `const metadata = db.metadata.get.first()
return metadata?.Title`,
    BeatmapSet: `const set = db.sets.get.first()
return set?.OnlineID`,
    BeatmapSetSnapshot: `const set = db.sets.get.first()
return set?.OnlineID`,
    BeatmapSnapshot: `const beatmap = db.beatmaps.get.first()
return beatmap?.Metadata?.Title`,
    File: `const file = db.files.get.first()
return file?.Hash`,
    FileSnapshot: `const file = db.files.get.first()
return file?.Hash`,
    KeyBinding: `${importLine(['getManiaDefaults'])}

return getManiaDefaults(4)[0]`,
    KeyBindingDef: `${importLine(['getManiaDefaults'])}

return getManiaDefaults(4)[0]`,
    KeyBindingSnapshot: `${importLine(['getManiaDefaults'])}

return getManiaDefaults(4)[0]`,
    ModPreset: `const preset = db.modpresets.get.first()
return preset?.Name`,
    ModPresetSnapshot: `const preset = db.modpresets.get.first()
return preset?.Name`,
    OsuBeatmap: `${importLine(['parseOsu'])}

const beatmap = parseOsu(source)
return beatmap.metadata.title`,
    OsuGeneral: `${importLine(['parseOsu'])}

return parseOsu(source).general`,
    OsuMetadata: `${importLine(['parseOsu'])}

return parseOsu(source).metadata`,
    OsuDifficulty: `${importLine(['parseOsu'])}

return parseOsu(source).difficulty`,
    OsuEvent: `${importLine(['parseOsu'])}

return parseOsu(source).events[0]`,
    HitObject: `${importLine(['parseOsu'])}

return parseOsu(source).hitObjects[0]`,
    HitCircle: `${importLine(['parseOsu'])}

return parseOsu(source).hitObjects[0]`,
    HitSlider: `${importLine(['parseOsu'])}

return parseOsu(source).hitObjects[0]`,
    HitSpinner: `${importLine(['parseOsu'])}

return parseOsu(source).hitObjects[0]`,
    HitHold: `${importLine(['parseOsu'])}

return parseOsu(source).hitObjects[0]`,
    Score: `const score = db.scores.get.first()
return score?.PP`,
    ScoreSnapshot: `const score = db.scores.get.first()
return score?.PP`,
    RealmFile: `const file = db.files.get.first()
return file?.Hash`,
    RealmNamedFileUsage: `const set = db.sets.get.first()
return set?.Files[0]?.Filename`,
    RealmUser: `const beatmap = db.beatmaps.get.first()
return beatmap?.Metadata?.Author?.Username`,
    Ruleset: `const ruleset = db.rulesets.get.first()
return ruleset?.Name`,
    RulesetSnapshot: `const ruleset = db.rulesets.get.first()
return ruleset?.Name`,
    RulesetSetting: `const setting = db.rulesetSettings.get.first()
return setting?.Value`,
    RulesetSettingSnapshot: `const setting = db.rulesetSettings.get.first()
return setting?.Value`,
    Skin: `const skin = db.skins.get.first()
return skin?.Name`,
    SkinSnapshot: `const skin = db.skins.get.first()
return skin?.Name`,
    SkinIni: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource)`,
    SkinIniDocument: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource)`,
    SkinIniGeneral: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).general`,
    SkinIniColours: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).colours`,
    SkinIniFonts: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).fonts`,
    SkinIniMania: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).mania`,
    SkinIniNode: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).nodes[0]`,
    SkinIniLineNode: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).nodes[0]`,
    SkinIniEntryNode: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).nodes.find(node => node.kind === 'entry')`,
    SkinIniSectionNode: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).nodes.find(node => node.kind === 'section')`,
    SkinIniParseIssue: `${importLine(['parseSkinIni'])}

return parseSkinIni(skinIniSource).issues[0]`,
    TimingPoint: `${importLine(['parseOsu'])}

return parseOsu(source).timingPoints[0]`,
    SliderExtras: `${importLine(['parseOsu'])}

return parseOsu(source).hitObjects[0]`,
    OsuColour: `${importLine(['parseOsu'])}

return parseOsu(source).colours[0]`,
    InitOptions: `const options = {
  readOnly: true,
  filesFolderPath: './files',
}

return options`,
    OsuFilesAPI: `import init from 'osu-files'

const db = init('./client.realm', { readOnly: true })
db.close()

return db`,
    RollbackOptions: `const options = { enabled: true }
return options`,
    MigrationEvent: `const event = { type: 'started', version: 1 }
return event`,
    MigrationReport: `const report = { migrated: false, events: [] }
return report`,
    IntegrityIssue: `const issue = { code: 'missing-file', severity: 'warning', message: 'File is missing' }
return issue`,
    IntegrityReport: `const report = { valid: true, checkedOwners: 0, checkedFiles: 0, errors: [], warnings: [] }
return report`,
    FileCleanupReport: `const report = { removed: 0, retained: 0, errors: [] }
return report`,
    ImportedSkinData: `const skin = { id: 'skin-id', name: 'Example', fileCount: 1 }
return skin`,
    BeatmapSetData: `const set = { beatmaps: [], files: [] }
return set`,
    BeatmapSetFile: `const file = { filename: 'audio.mp3', hash: 'a'.repeat(64) }
return file`,
    BeatmapUserSettings: `const settings = { Offset: 0 }
return settings`,
    RulesetModule: `return db.rulesets.get.first()?.Name`,
    RulesetSettingModule: `return db.rulesetSettings.get.first()?.Value`,
    BeatmapCollectionModule: `return db.collections.get.first()?.Name`,
    BeatmapMetadataModule: `return db.metadata.get.first()?.Title`,
    KeyBindingModule: `return db.keybindings.get.first()?.KeyCombination`,
    ModPresetModule: `return db.modpresets.get.first()?.Name`,
    Sets: `return db.sets.get.first()?.OnlineID`,
    Collections: `return db.collections.get.first()?.Name`,
    Scores: `return db.scores.get.first()?.PP`,
    Skins: `return db.skins.get.first()?.Name`,
    Files: `return db.files.get.first()?.Hash`,
    Rulesets: `return db.rulesets.get.first()?.Name`,
    RulesetSettings: `return db.rulesetSettings.get.first()?.Value`,
    Metadata: `return db.metadata.get.first()?.Title`,
  }
  if (name === 'Crud') return `import type { Crud } from 'osu-files'

const value = {} as Crud<unknown>
return value`
  if (producerExamples[name]) return producerExamples[name]
  if (/^(?:BlendingMode|OverlayPosition|SampleSet|RulesetShortName|StoryboardLayerName|TriggerName)$/.test(name)) return `const value = 'Foreground'
return value`
  if (/^(?:Osu|Hit|Timing|Slider|SkinIni|Beatmap|Score|Ruleset|Collection|File|KeyBinding|ModPreset|Realm|Migration|Integrity|Rollback|Imported)/.test(name)) return `const value = {} as ${name}
return value`
  return `const value = {} as ${name}
return value`
}

function storyboardMemberExample(owner: string, member: string): string | undefined {
  if (owner === 'Crud') {
    const setup = `import type { Crud } from 'osu-files'

const value = {} as Crud<unknown>`
    const calls: Record<string, string> = {
      create: `return value.create({})`,
      update: `return value.update('id', {})`,
      delete: `return value.delete('id')`,
      upsert: `return value.upsert({})`,
    }
    return calls[member] ? `${setup}\n\n${calls[member]}` : undefined
  }
  if (owner === 'Storyboard') {
    const setup = `${importLine(['Storyboard'])}\n\nconst storyboard = new Storyboard()`
    const expressions: Record<string, string> = {
      getLayer: `const layer = storyboard.getLayer('Foreground')\nreturn { name: layer.name, depth: layer.depth }`,
      hasLayer: `storyboard.getLayer('Foreground')\nreturn storyboard.hasLayer('Foreground')`,
      removeLayer: `storyboard.getLayer('Foreground')\nstoryboard.removeLayer('Foreground')\nreturn storyboard.hasLayer('Foreground')`,
      renameLayer: `storyboard.getLayer('Foreground')\nstoryboard.renameLayer('Foreground', 'Overlay')\nreturn storyboard.hasLayer('Overlay')`,
      clearLayers: `storyboard.getLayer('Foreground')\nstoryboard.clearLayers()\nreturn storyboard.layers.size`,
      hasDrawable: `return storyboard.hasDrawable`,
      earliestEventTime: `return storyboard.earliestEventTime`,
      latestEventTime: `return storyboard.latestEventTime`,
    }
    return expressions[member] ? `${setup}\n\n${expressions[member]}` : undefined
  }

  if (owner === 'StoryboardLayer') {
    const setup = `${storyboardSetup}\n\nconst layer = storyboard.getLayer('Foreground')`
    const expressions: Record<string, string> = {
      count: `return layer.count`,
      add: `layer.add(sprite)\nreturn layer.count`,
      get: `layer.add(sprite)\nreturn layer.get(0)?.path`,
      remove: `layer.add(sprite)\nlayer.remove(sprite)\nreturn layer.count`,
      removeAt: `layer.add(sprite)\nlayer.removeAt(0)\nreturn layer.count`,
      insertAt: `layer.insertAt(0, sprite)\nreturn layer.get(0)?.path`,
      clear: `layer.add(sprite)\nlayer.clear()\nreturn layer.count`,
      moveUp: `layer.add(sprite)\nlayer.moveUp(sprite)\nreturn layer.get(0)?.path`,
      moveDown: `layer.add(sprite)\nlayer.moveDown(sprite)\nreturn layer.get(0)?.path`,
    }
    return expressions[member] ? `${setup}\n\n${expressions[member]}` : undefined
  }

  if (owner === 'StoryboardSprite' || owner === 'StoryboardAnimation') {
    const setup = storyboardSetup
    const expressions: Record<string, string> = {
      path: `return sprite.path`,
      startTime: `sprite.addScale(Easing.Out, 0, 1000, 1.1)\nreturn sprite.startTime`,
      endTime: `sprite.addScale(Easing.Out, 0, 1000, 1.1)\nreturn sprite.endTime`,
      addAlpha: `sprite.addAlpha(Easing.Out, 0, 500, 1, 0)\nreturn sprite.commands.alpha.length`,
      addMoveX: `sprite.addMoveX(Easing.Out, 0, 500, 400, 320)\nreturn sprite.commands.x.length`,
      addMoveY: `sprite.addMoveY(Easing.Out, 0, 500, 300, 240)\nreturn sprite.commands.y.length`,
      addScale: `sprite.addScale(Easing.Out, 0, 500, 1.1, 1)\nreturn sprite.commands.scale.length`,
      addVectorScale: `sprite.addVectorScale(Easing.Out, 0, 500, 1.1, 1.1)\nreturn sprite.commands.vectorScale.length`,
      addRotation: `sprite.addRotation(Easing.Out, 0, 500, 1)\nreturn sprite.commands.rotation.length`,
      addColour: `sprite.addColour(Easing.Out, 0, 500, 255, 200, 180)\nreturn sprite.commands.colour.length`,
      addFlipH: `sprite.addFlipH(Easing.None, 0, undefined, true)\nreturn sprite.commands.flipH.length`,
      addFlipV: `sprite.addFlipV(Easing.None, 0, undefined, true)\nreturn sprite.commands.flipV.length`,
      addBlending: `sprite.addBlending(Easing.None, 0, undefined, 'Additive')\nreturn sprite.commands.blending.length`,
      addLoopingGroup: `const group = sprite.addLoopingGroup(0, 2)\nreturn group.totalIterations`,
      addTriggerGroup: `const group = sprite.addTriggerGroup('HitSound', 0, 1000, 0)\nreturn group.triggerName`,
      removeLoopingGroup: `sprite.addLoopingGroup(0, 2)\nsprite.removeLoopingGroup(0)\nreturn sprite.loopingGroups.length`,
      clearLoopingGroups: `sprite.addLoopingGroup(0, 2)\nsprite.clearLoopingGroups()\nreturn sprite.loopingGroups.length`,
      removeTriggerGroup: `sprite.addTriggerGroup('HitSound', 0, 1000, 0)\nsprite.removeTriggerGroup(0)\nreturn sprite.triggerGroups.length`,
      clearTriggerGroups: `sprite.addTriggerGroup('HitSound', 0, 1000, 0)\nsprite.clearTriggerGroups()\nreturn sprite.triggerGroups.length`,
      clone: `const copy = sprite.clone()\nreturn { sameFile: copy.path === sprite.path, commands: copy.commands.allCommands().length }`,
    }
    return expressions[member] ? `${setup}\n\n${expressions[member]}` : undefined
  }

  if (['StoryboardCommandGroup', 'StoryboardLoopingGroup', 'StoryboardTriggerGroup'].includes(owner)) {
    const expressions: Record<string, string> = {
      startTime: `return commands.startTime`,
      endTime: `return commands.endTime`,
      allCommands: `return commands.allCommands().map(command => command.commandType)`,
      arrayFor: `return commands.arrayFor(CommandType.Fade).length`,
      addAlpha: `commands.addAlpha(Easing.Out, 0, 500, 1, 0)\nreturn commands.alpha.length`,
      addX: `commands.addX(Easing.Out, 0, 500, 320, 0)\nreturn commands.x.length`,
      addY: `commands.addY(Easing.Out, 0, 500, 240, 0)\nreturn commands.y.length`,
      addScale: `commands.addScale(Easing.Out, 0, 500, 1.1, 1)\nreturn commands.scale.length`,
      removeAlpha: `commands.removeAlpha(0)\nreturn commands.alpha.length`,
      clearAlpha: `commands.clearAlpha()\nreturn commands.alpha.length`,
      clearAll: `commands.clearAll()\nreturn commands.allCommands().length`,
      shiftTimes: `commands.shiftTimes(250)\nreturn commands.startTime`,
      setAlpha: `commands.setAlpha(0, { endValue: 0.5 })\nreturn commands.alpha[0]?.endValue`,
    }
    if (expressions[member]) return `${commandSetup}\n\n${expressions[member]}`
    if (/^(?:add|remove|clear|set)/.test(member)) return `${commandSetup}\n\nreturn commands.allCommands().length`
  }

  return undefined
}

export function templateForReflection(reflection: Reflection, parent?: Reflection): string {
  if (!parent) {
    if (reflection.kind === 64) return functionExample(reflection.name) ?? `return undefined`
    if (reflection.kind === 128) return classExample(reflection.name) ?? `const value = new ${reflection.name}()\nreturn value`
    if (reflection.kind === 256) return interfaceExample(reflection.name) ?? `const value = {}\nreturn value`
    if (reflection.kind === 8) return enumExample(reflection)
    if (reflection.kind === 2097152) return typeExample(reflection.name) ?? `const value = {} as ${reflection.name}\nreturn value`
    return `return undefined`
  }

  if ([512, 2048, 262144].includes(reflection.kind)) {
    if (reflection.kind === 512 && parent.name === 'FileStore') return `${importLine(['FileStore'])}

const store = new FileStore('./files')

return store`
    if (reflection.kind === 512) return classExample(parent.name) ?? `const value = new ${parent.name}()\nreturn value`
    if (parent.name === 'FileStore') return fileStoreMemberExample(reflection.name) ?? `return undefined`
    return storyboardMemberExample(parent.name, reflection.name)
      ?? classExample(parent.name)
      ?? `return undefined`
  }
  return `return undefined`
}
