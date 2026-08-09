export type ExampleSession = { loaded: true; source: string }

export function readExampleSession(key: string): ExampleSession | undefined {
  try {
    const value = sessionStorage.getItem(key)
    if (!value) return undefined
    const parsed = JSON.parse(value) as Partial<ExampleSession>
    return parsed.loaded === true && typeof parsed.source === 'string' ? { loaded: true, source: parsed.source } : undefined
  } catch {
    return undefined
  }
}

export function writeExampleSession(key: string, source: string): void {
  try { sessionStorage.setItem(key, JSON.stringify({ loaded: true, source } satisfies ExampleSession)) } catch {}
}

export function clearExampleSession(key: string): void {
  try { sessionStorage.removeItem(key) } catch {}
}
