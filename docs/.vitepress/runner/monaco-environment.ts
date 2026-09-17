export async function configureMonacoWorkers() {
  const [{ default: EditorWorker }, { default: TypeScriptWorker }] = await Promise.all([
    import('../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker'),
    import('../../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js?worker'),
    import('../../../node_modules/monaco-editor/esm/vs/language/typescript/monaco.contribution.js'),
  ])
  ;(globalThis as any).MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === 'typescript' || label === 'javascript') return new TypeScriptWorker()
      return new EditorWorker()
    },
  }
}
