export function transformExample(source: string): { code: string; names: string[] } {
  if (/\b(?:import|export)\s*\(/.test(source)) throw new Error('Dynamic imports are not allowed in documentation examples.')
  const names: string[] = []
  let code = source.replace(/import\s+(type\s+)?\{([^}]+)\}\s*from\s*['"]osu-files['"]\s*;?/g, (_match, typeOnly: string | undefined, imports: string) => {
    if (typeOnly) return ''
    for (const item of imports.split(',')) {
      const [original, alias] = item.trim().split(/\s+as\s+/)
      if (!original) continue
      names.push(alias || original)
    }
    return ''
  })
  if (/\bimport\s/.test(code)) throw new Error('Only the public osu-files import is allowed.')
  for (const globalName of ['window', 'document', 'parent', 'localStorage', 'sessionStorage']) {
    const isLocal = new RegExp(`\\b(?:const|let|var|function|class)\\s+${globalName}\\b`).test(code)
    if (!isLocal && new RegExp(`\\b${globalName}\\s*(?:[.(\\[])`).test(code)) throw new Error('Page and storage globals are unavailable in the runner.')
  }
  if (/\b(?:export\s+default\s+)?function\s+run\b/.test(code)) throw new Error('The documentation runner supplies the run wrapper automatically.')
  if (/\bfixture\b/.test(code)) names.push('fixture')
  return { code, names }
}
