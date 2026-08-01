export type LintDiagnostic = { kind: 'lint'; code: string; message: string; start: number; length: number; severity: 'error' | 'warning' }

const forbiddenGlobals = ['require', 'process', 'Buffer', 'window', 'document', 'localStorage', 'sessionStorage', 'fs', 'path', 'os']

export function lintExample(source: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = []

  for (const match of source.matchAll(/(?:import|export)\s*\(/g)) {
    diagnostics.push({ kind: 'lint', code: 'docs/no-dynamic-import', message: 'Dynamic imports are not available in documentation examples.', start: match.index ?? 0, length: match[0].length, severity: 'error' })
  }

  for (const match of source.matchAll(/(?:from\s+|import\s+)(['"])([^'"]+)\1/g)) {
    const moduleName = match[2]
    if (moduleName !== 'osu-files') {
      diagnostics.push({ kind: 'lint', code: 'docs/no-unsupported-import', message: `Only the public osu-files import is available here; '${moduleName}' is not allowed.`, start: match.index ?? 0, length: match[0].length, severity: 'error' })
    }
  }

  for (const globalName of forbiddenGlobals) {
    const pattern = new RegExp(`(?<![.$\\w])${globalName}\\b(?!\\s*:)`, 'g')
    for (const match of source.matchAll(pattern)) {
      diagnostics.push({ kind: 'lint', code: 'docs/no-node-global', message: `'${globalName}' is unavailable in the documentation sandbox.`, start: match.index ?? 0, length: globalName.length, severity: 'error' })
    }
  }

  if (/\b(?:export\s+default\s+)?function\s+run\b/.test(source)) {
    diagnostics.push({ kind: 'lint', code: 'docs/no-hidden-runtime-wrapper', message: 'The documentation runner supplies the run wrapper automatically.', start: source.indexOf('function'), length: 8, severity: 'error' })
  }

  return diagnostics
}
