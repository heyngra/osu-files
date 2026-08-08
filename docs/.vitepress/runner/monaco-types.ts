import manifest from '../../.generated/runner-types.json'

let configured = false

export function configureMonacoTypes(monaco: any) {
  if (configured) return
  configured = true
  const defaults = monaco.languages.typescript.typescriptDefaults
  const forceModuleDetection = monaco.languages.typescript.ModuleDetectionKind?.Force ?? 3
  defaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleDetection: forceModuleDetection,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    baseUrl: '/',
    paths: {
      'osu-files': [manifest.packageEntry.replace(/^file:\/\//, '')],
      '@docs/fixture': ['/node_modules/@docs/fixture/index.d.ts'],
    },
  })
  defaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false })
  for (const file of manifest.files) defaults.addExtraLib(file.content, file.uri)
}
