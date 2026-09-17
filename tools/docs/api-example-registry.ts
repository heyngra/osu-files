export type ApiExampleExecution =
  | 'interactive'
  | 'interactive-with-limitation'
  | 'interactive-fixture'
  | 'static-node-only'

export type ApiExamplePolicy = {
  execution: ApiExampleExecution
  fixture?: 'realm-docs'
  verify: boolean
}

const browserExports = new Set([
  'Anchor', 'CommandType', 'Easing', 'FileRef', 'GlobalAction', 'InputKey',
  'LoopType', 'ManiaAction', 'OsuAction', 'RulesetName', 'RulesetOnlineID',
  'SliderCurveType', 'TaikoAction',
  'Storyboard', 'StoryboardAlphaCommand', 'StoryboardAnimation',
  'StoryboardBlendingCommand', 'StoryboardColourCommand', 'StoryboardCommandGroup',
  'StoryboardFlipHCommand', 'StoryboardFlipVCommand', 'StoryboardLayer',
  'StoryboardLoopingGroup', 'StoryboardRotationCommand', 'StoryboardSample',
  'StoryboardScaleCommand', 'StoryboardSprite', 'StoryboardTriggerGroup',
  'StoryboardVectorScaleCommand', 'StoryboardXCommand', 'StoryboardYCommand',
  'cloneSkinIni', 'createFileRef', 'getManiaDefaults', 'parseOsb', 'parseOsu', 'parseSkinIni',
  'parseStoryboard', 'serializeOsb', 'serializeOsu', 'serializeSkinIni',
  'serializeStoryboard', 'serializeStoryboardForOsu', 'serializeStoryboardForOsb',
])

const nodeOnlyTargets = new Set([
  'computeSkinHash', 'fullSkinContentHash', 'hasFilesFolder', 'init',
  'FileStore', 'RealmClosedError', 'RealmReadOnlyError', 'RealmSession',
  'RollbackEntry', 'RollbackLogger', 'Crud', 'RollbackOptions', 'OsuFilesAPI',
])

const nodeOnlyPrefixes = [
  'FileStore.', 'RealmSession.', 'RollbackEntry.', 'RollbackLogger.',
  'Crud.', 'EditSession.', 'OsuFilesAPI.', 'InitOptions.',
]

function importsAreBrowserSafe(code: string): boolean {
  const matches = code.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]osu-files['"]/g)
  let found = false
  for (const match of matches) {
    found = true
    for (const item of match[1].split(',')) {
      const name = item.trim().split(/\s+as\s+/)[0]
      if (name && !browserExports.has(name)) return false
    }
  }
  return found || !/\b(?:node:|fs\.|Buffer|process\.|Realm)\b/.test(code)
}

export function policyForExample(target: string, code: string): ApiExamplePolicy {
  if (nodeOnlyTargets.has(target) || nodeOnlyPrefixes.some(prefix => target.startsWith(prefix)))
    return { execution: 'static-node-only', verify: false }

  if (/\b(?:satisfies|using|as\s+[A-Z_$][\w$]*(?:\s*<[^>]+>)?)\b/.test(code))
    return { execution: 'static-node-only', verify: false }

  if (/\bdb\s*\./.test(code))
    return { execution: 'interactive-fixture', fixture: 'realm-docs', verify: true }

  if (importsAreBrowserSafe(code))
    return { execution: 'interactive', fixture: 'realm-docs', verify: true }

  return { execution: 'static-node-only', verify: false }
}

export function isBrowserExport(name: string): boolean {
  return browserExports.has(name)
}
