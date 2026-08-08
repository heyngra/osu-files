<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import OutputPanel from './OutputPanel.vue'
import { lintExample, type LintDiagnostic } from '../runner/docs-linter.js'
import { configureMonacoWorkers } from '../runner/monaco-environment.js'
import { configureMonacoTypes } from '../runner/monaco-types.js'

const props = withDefaults(defineProps<{
  id?: string
  code: string
  execution?: 'interactive' | 'interactive-with-limitation' | 'interactive-fixture' | 'static-node-only'
  title?: string
  output?: string
  fixture?: string
  initiallyActive?: boolean
}>(), { execution: 'interactive', fixture: 'realm-docs', initiallyActive: false })

const editorHost = ref<HTMLElement>()
const source = ref(props.code)
const result = ref(props.output)
const logs = ref<Array<{ level: string; args: string[] }>>([])
const error = ref('')
const diagnostics = ref<LintDiagnostic[]>([])
const typeDiagnostics = ref<Array<{ message: string; severity: number }>>([])
const running = ref(false)
const editorReady = ref(false)
const runnable = computed(() => props.execution !== 'static-node-only')
type RunnerState = 'preview' | 'loading' | 'ready' | 'failed' | 'static-node-only'
const state = ref<RunnerState>(props.initiallyActive && runnable.value ? 'loading' : (runnable.value ? 'preview' : 'static-node-only'))
const loadError = ref('')
const hasErrors = computed(() => diagnostics.value.some(diagnostic => diagnostic.severity === 'error') || typeDiagnostics.value.some(diagnostic => diagnostic.severity === 8))
const exampleId = computed(() => props.id ?? (props.title ?? 'example').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
const fileName = computed(() => `${exampleId.value}.ts`)
const fixtureUrl = computed(() => `/fixtures/${props.fixture}.json`)
const storageKey = computed(() => `osu-files:docs:runner:${exampleId.value}`)
const activeTab = ref<'output' | 'console' | 'problems'>('output')
const confirmReset = ref(false)
const problemsCount = computed(() => diagnostics.value.length + typeDiagnostics.value.length)
let monaco: any
let editor: any
let model: any
let activeWorker: Worker | undefined
let pendingRun = false
let lintTimer: number | undefined
let runTimer: number | undefined
let themeObserver: MutationObserver | undefined
let editorLoadPromise: Promise<void> | undefined

type SessionRunnerState = { loaded: true; source: string }

function readSession(): SessionRunnerState | undefined {
  try {
    const value = sessionStorage.getItem(storageKey.value)
    if (!value) return undefined
    const parsed = JSON.parse(value) as Partial<SessionRunnerState>
    return parsed.loaded === true && typeof parsed.source === 'string' ? { loaded: true, source: parsed.source } : undefined
  } catch { return undefined }
}

function writeSession() {
  try { sessionStorage.setItem(storageKey.value, JSON.stringify({ loaded: true, source: source.value } satisfies SessionRunnerState)) } catch { /* storage is optional */ }
}

function clearSession() {
  try { sessionStorage.removeItem(storageKey.value) } catch { /* storage is optional */ }
}

function updateDiagnostics() {
  const next = lintExample(source.value)
  diagnostics.value = next
  if (!model || !monaco) return
  monaco.editor.setModelMarkers(model, 'osu-files-docs', next.map(diagnostic => {
    const before = source.value.slice(0, diagnostic.start)
    const lines = before.split('\n')
    const startLineNumber = lines.length
    const startColumn = lines.at(-1)!.length + 1
    return { startLineNumber, startColumn, endLineNumber: startLineNumber, endColumn: startColumn + diagnostic.length, message: diagnostic.message, severity: diagnostic.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, code: diagnostic.code }
  }))
  refreshTypeDiagnostics()
}

function refreshTypeDiagnostics() {
  if (!model || !monaco) return
  const markers = monaco.editor.getModelMarkers({ resource: model.uri }).filter((marker: any) => marker.owner !== 'osu-files-docs')
  const visible = markers.filter((marker: any) => !/declared but its value is never read|A 'return' statement can only be used within a function body/.test(marker.message))
  for (const owner of new Set(markers.map((marker: any) => marker.owner))) {
    monaco.editor.setModelMarkers(model, owner, visible.filter((marker: any) => marker.owner === owner))
  }
  typeDiagnostics.value = visible.map((marker: any) => ({ message: marker.message, severity: marker.severity }))
}

function stop() {
  activeWorker?.terminate()
  activeWorker = undefined
  running.value = false
}

function finishRun() {
  running.value = false
  if (pendingRun) { pendingRun = false; run() }
}

function scheduleRun() {
  window.clearTimeout(runTimer)
  runTimer = window.setTimeout(() => { if (!running.value) run() }, 350)
}

async function run() {
  if (!runnable.value) return
  if (!editorReady.value) {
    await loadEditor()
    if (!editorReady.value) return
  }
  if (hasErrors.value) return
  if (running.value) { pendingRun = true; return }
  pendingRun = false
  error.value = ''
  logs.value = []
  result.value = 'Running…'
  running.value = true
  const worker = new Worker(new URL('../runner/worker.ts', import.meta.url), { type: 'module' })
  activeWorker = worker
  const timeout = window.setTimeout(() => { worker.terminate(); activeWorker = undefined; error.value = 'Timed out after 4 seconds.'; finishRun() }, 4000)
  worker.onmessage = (event: MessageEvent<{ value?: string; logs?: Array<{ level: string; args: string[] }>; error?: string }>) => {
    window.clearTimeout(timeout)
    result.value = event.data.value ?? ''
    logs.value = event.data.logs ?? []
    error.value = event.data.error ?? ''
    worker.terminate(); activeWorker = undefined
    finishRun()
  }
  const execution = props.execution === 'static-node-only' ? 'interactive' : (props.execution ?? 'interactive')
  worker.postMessage({ source: source.value, fixtureUrl: fixtureUrl.value, execution })
}

function reset() {
  confirmReset.value = false
  window.clearTimeout(runTimer)
  pendingRun = false
  if (!editorReady.value) { clearSession(); source.value = props.code; return }
  stop()
  source.value = props.code
  model?.setValue(props.code)
  result.value = props.output ?? 'Run the example to inspect its return value.'
  logs.value = []
  error.value = ''
  writeSession()
  updateDiagnostics()
  run()
}

async function copy() { await navigator.clipboard?.writeText(source.value) }

function setTheme() {
  if (!monaco) return
  const dark = document.documentElement.classList.contains('dark')
  monaco.editor.setTheme(dark ? 'osu-files-dark' : 'osu-files-light')
}

function defineThemes() {
  const common = (base: 'vs' | 'vs-dark', rules: any[], colors: Record<string, string>) => ({ base, inherit: true, rules, colors })
  const latte = common('vs', [
    { token: 'comment', foreground: '#6c6f85', fontStyle: 'italic' },
    { token: 'keyword', foreground: '#8839ef' }, { token: 'keyword.control', foreground: '#8839ef' },
    { token: 'string', foreground: '#40a02b' }, { token: 'string.quote', foreground: '#40a02b' }, { token: 'string.escape', foreground: '#ea76cb' },
    { token: 'number', foreground: '#fe640b' }, { token: 'constant', foreground: '#fe640b' },
    { token: 'type', foreground: '#1e66f5' }, { token: 'type.identifier', foreground: '#1e66f5' }, { token: 'key', foreground: '#1e66f5' },
    { token: 'identifier', foreground: '#4c4f69' }, { token: 'variable', foreground: '#4c4f69' }, { token: 'parameter', foreground: '#4c4f69' }, { token: 'property', foreground: '#4c4f69' },
    { token: 'function', foreground: '#1e66f5' }, { token: 'class', foreground: '#df8e1d' },
    { token: 'operator', foreground: '#179299' }, { token: 'delimiter', foreground: '#7c7f93' }, { token: 'delimiter.bracket', foreground: '#7c7f93' },
    { token: 'tag', foreground: '#d20f39' }, { token: 'attribute.name', foreground: '#40a02b' }, { token: 'attribute.value', foreground: '#8839ef' },
    { token: 'regexp', foreground: '#df8e1d' },
  ], {
    'editor.background': '#00000000', 'editorGutter.background': '#00000000',
    'editorLineNumber.foreground': '#9ca0b0', 'editorLineNumber.activeForeground': '#6c6f85',
    'editorCursor.foreground': '#dc8a78', 'editor.selectionBackground': '#bcc0cc55', 'editor.selectionHighlightBackground': '#ccd0da66', 'editor.inactiveSelectionBackground': '#ccd0da44',
    'editor.lineHighlightBackground': '#00000000', 'editorLineHighlight.border': '#00000000',
    'scrollbarSlider.background': '#7c7f9326', 'scrollbarSlider.hoverBackground': '#7c7f934d', 'scrollbarSlider.activeBackground': '#7c7f9370', 'scrollbar.shadow': '#00000000',
    'editorWidget.background': '#e6e9ef', 'editorWidget.border': '#bcc0cc',
    'editorSuggestWidget.background': '#e6e9ef', 'editorSuggestWidget.foreground': '#4c4f69', 'editorSuggestWidget.selectedBackground': '#ccd0da', 'editorSuggestWidget.selectedForeground': '#4c4f69', 'editorSuggestWidget.highlightForeground': '#ea76cb', 'editorSuggestWidget.focusHighlightForeground': '#ea76cb', 'editorSuggestWidget.selectedIconForeground': '#ea76cb', 'editorSuggestWidgetStatus.foreground': '#6c6f85',
    'editorHoverWidget.background': '#e6e9ef', 'editorHoverWidget.foreground': '#4c4f69', 'editorHoverWidget.border': '#bcc0cc', 'editorHoverWidget.highlightForeground': '#ea76cb', 'editorHoverWidget.statusBarBackground': '#dce0e8',
    'focusBorder': '#ea76cb', 'textLink.foreground': '#1e66f5', 'textCodeBlock.background': '#e6e9ef',
    'editorBracketHighlight.foreground1': '#d20f39', 'editorBracketHighlight.foreground2': '#df8e1d', 'editorBracketHighlight.foreground3': '#40a02b', 'editorBracketHighlight.foreground4': '#1e66f5', 'editorBracketHighlight.foreground5': '#8839ef', 'editorBracketHighlight.foreground6': '#ea76cb',
    'editorBracketPairGuide.background1': '#d20f39', 'editorBracketPairGuide.background2': '#df8e1d', 'editorBracketPairGuide.background3': '#40a02b', 'editorBracketPairGuide.background4': '#1e66f5', 'editorBracketPairGuide.background5': '#8839ef', 'editorBracketPairGuide.background6': '#ea76cb',
  })
  const mocha = common('vs-dark', [
    { token: 'comment', foreground: '#6c7086', fontStyle: 'italic' },
    { token: 'keyword', foreground: '#cba6f7' }, { token: 'keyword.control', foreground: '#cba6f7' },
    { token: 'string', foreground: '#a6e3a1' }, { token: 'string.quote', foreground: '#a6e3a1' }, { token: 'string.escape', foreground: '#f5c2e7' },
    { token: 'number', foreground: '#fab387' }, { token: 'constant', foreground: '#fab387' },
    { token: 'type', foreground: '#89b4fa' }, { token: 'type.identifier', foreground: '#89b4fa' }, { token: 'key', foreground: '#89b4fa' },
    { token: 'identifier', foreground: '#cdd6f4' }, { token: 'variable', foreground: '#cdd6f4' }, { token: 'parameter', foreground: '#cdd6f4' }, { token: 'property', foreground: '#cdd6f4' },
    { token: 'function', foreground: '#89b4fa' }, { token: 'class', foreground: '#f9e2af' },
    { token: 'operator', foreground: '#94e2d5' }, { token: 'delimiter', foreground: '#9399b2' }, { token: 'delimiter.bracket', foreground: '#9399b2' },
    { token: 'tag', foreground: '#f38ba8' }, { token: 'attribute.name', foreground: '#a6e3a1' }, { token: 'attribute.value', foreground: '#cba6f7' },
    { token: 'regexp', foreground: '#f9e2af' },
  ], {
    'editor.background': '#00000000', 'editorGutter.background': '#00000000',
    'editorLineNumber.foreground': '#585b70', 'editorLineNumber.activeForeground': '#a6adc8',
    'editorCursor.foreground': '#f5e0dc', 'editor.selectionBackground': '#45475a99', 'editor.selectionHighlightBackground': '#31324466', 'editor.inactiveSelectionBackground': '#31324444',
    'editor.lineHighlightBackground': '#00000000', 'editorLineHighlight.border': '#00000000',
    'scrollbarSlider.background': '#6c708626', 'scrollbarSlider.hoverBackground': '#6c70864d', 'scrollbarSlider.activeBackground': '#6c708670', 'scrollbar.shadow': '#00000000',
    'editorWidget.background': '#313244', 'editorWidget.border': '#45475a',
    'editorSuggestWidget.background': '#1e1e2e', 'editorSuggestWidget.foreground': '#cdd6f4', 'editorSuggestWidget.selectedBackground': '#313244', 'editorSuggestWidget.selectedForeground': '#f5c2e7', 'editorSuggestWidget.highlightForeground': '#f5c2e7', 'editorSuggestWidget.focusHighlightForeground': '#f5c2e7', 'editorSuggestWidget.selectedIconForeground': '#f5c2e7', 'editorSuggestWidgetStatus.foreground': '#a6adc8',
    'editorHoverWidget.background': '#1e1e2e', 'editorHoverWidget.foreground': '#cdd6f4', 'editorHoverWidget.border': '#45475a', 'editorHoverWidget.highlightForeground': '#f5c2e7', 'editorHoverWidget.statusBarBackground': '#181825',
    'focusBorder': '#f5c2e7', 'textLink.foreground': '#89b4fa', 'textCodeBlock.background': '#181825',
    'editorBracketHighlight.foreground1': '#f38ba8', 'editorBracketHighlight.foreground2': '#f9e2af', 'editorBracketHighlight.foreground3': '#a6e3a1', 'editorBracketHighlight.foreground4': '#89b4fa', 'editorBracketHighlight.foreground5': '#cba6f7', 'editorBracketHighlight.foreground6': '#f5c2e7',
    'editorBracketPairGuide.background1': '#f38ba8', 'editorBracketPairGuide.background2': '#f9e2af', 'editorBracketPairGuide.background3': '#a6e3a1', 'editorBracketPairGuide.background4': '#89b4fa', 'editorBracketPairGuide.background5': '#cba6f7', 'editorBracketPairGuide.background6': '#f5c2e7',
  })
  monaco.editor.defineTheme('osu-files-light', latte)
  monaco.editor.defineTheme('osu-files-dark', mocha)
}

async function loadEditor() {
  if (state.value === 'ready') return
  if (editorLoadPromise) return editorLoadPromise
  editorLoadPromise = loadEditorInternal()
  try {
    await editorLoadPromise
  } finally {
    editorLoadPromise = undefined
  }
}

async function loadEditorInternal() {
  if (state.value === 'ready') return
  state.value = 'loading'
  loadError.value = ''
  const saved = readSession()
  const initialSource = saved?.source ?? props.code
  source.value = initialSource
  try {
    await nextTick()
    if (!editorHost.value) throw new Error('The editor container was not mounted.')
    monaco = await import('monaco-editor')
    await configureMonacoWorkers()
    configureMonacoTypes(monaco)
    defineThemes()
    model = monaco.editor.createModel(initialSource, 'typescript', monaco.Uri.parse(`file:///docs/examples/${exampleId.value}.ts`))
    editor = monaco.editor.create(editorHost.value, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      wordWrap: 'off',
      renderWhitespace: 'none',
      stickyScroll: { enabled: false },
      fontLigatures: true,
      cursorSmoothCaretAnimation: 'on',
      cursorBlinking: 'phase',
      lineNumbersMinChars: 4,
      fontSize: 14,
      lineHeight: 21,
      tabSize: 2,
      insertSpaces: true,
      smoothScrolling: true,
      renderLineHighlight: 'all',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: 'active', indentation: true },
      suggest: { showIcons: false },
      scrollBeyondLastLine: false,
      padding: { top: 8, bottom: 8 },
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
      fontFamily: `'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace`,
    })
    setTheme()
    themeObserver = new MutationObserver(setTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    editor.addAction({ id: 'run-example', label: 'Run example', keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run })
    editor.onDidChangeModelContent(() => {
      source.value = model.getValue()
      writeSession()
      window.clearTimeout(lintTimer)
      lintTimer = window.setTimeout(updateDiagnostics, 220)
      scheduleRun()
    })
    monaco.editor.onDidChangeMarkers(() => refreshTypeDiagnostics())
    editorReady.value = true
    state.value = 'ready'
    writeSession()
    updateDiagnostics()
  } catch (cause) {
    editor?.dispose(); model?.dispose(); editor = undefined; model = undefined; editorReady.value = false
    state.value = 'failed'
    loadError.value = cause instanceof Error ? cause.message : 'The editor could not be loaded.'
  }
}

watch([diagnostics, typeDiagnostics], ([lint, types]) => {
  if (lint.length || types.length) activeTab.value = 'problems'
})

onMounted(() => {
  const saved = readSession()
  if (saved) source.value = saved.source
  if (props.initiallyActive && runnable.value) void loadEditor()
})

onBeforeUnmount(() => { window.clearTimeout(lintTimer); window.clearTimeout(runTimer); themeObserver?.disconnect(); stop(); editor?.dispose(); model?.dispose() })
</script>

<template>
  <section :id="exampleId" class="api-example" :data-execution="execution">
    <header class="api-example__bar">
      <span class="api-example__tab" :title="fileName">{{ fileName }}</span>
      <span class="api-example__spacer" />
      <template v-if="runnable && state === 'ready'">
        <button class="api-example__btn api-example__btn--primary api-example__run" @click="run" :disabled="running || !editorReady || hasErrors" aria-label="Run (Ctrl+Enter)" data-tip="Run (Ctrl+Enter)">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3.2a.7.7 0 0 1 1.06-.6l7.1 4.8a.7.7 0 0 1 0 1.2l-7.1 4.8A.7.7 0 0 1 4 12.8z" /></svg>
        </button>
      </template>
      <template v-if="state === 'ready'">
        <button class="api-example__btn" @click="copy" aria-label="Copy code" data-tip="Copy code">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4.5A1.5 1.5 0 0 0 3 3.5v4.5a1.5 1.5 0 0 0 1.5 1.5h2" /></svg>
        </button>
        <button class="api-example__btn" @click="confirmReset = !confirmReset" aria-label="Reset example" data-tip="Reset example">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4.5 4.5 3.5 5.5M4.5 4.5l1-1M3.5 5.5h2a2.5 2.5 0 1 1-2.3 3.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </template>
    </header>

    <div class="api-example__body">
      <div v-if="state === 'preview' || state === 'failed' || state === 'static-node-only'" class="api-example__preview-wrap language-ts vp-adaptive-theme">
        <span class="lang">ts</span>
        <pre class="shiki shiki-themes github-light github-dark vp-code api-example__preview" tabindex="0" aria-label="TypeScript preview"><code>{{ source }}</code></pre>
        <button
          v-if="runnable"
          class="api-example__activate"
          @click="loadEditor"
          :disabled="state === 'loading'"
          :aria-label="state === 'loading' ? 'Loading runnable example' : 'Make example runnable'"
          :data-tip="state === 'loading' ? 'Loading runnable example' : 'Make example runnable'"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.25 3.35a.75.75 0 0 1 1.14-.64l7.2 4.65a.75.75 0 0 1 0 1.28l-7.2 4.65a.75.75 0 0 1-1.14-.64z" /></svg>
        </button>
        <p v-if="state === 'failed'" class="api-example__load-error">{{ loadError }}</p>
      </div>
      <div v-if="state === 'loading' || state === 'ready'" ref="editorHost" class="api-example__editor" aria-label="Editable TypeScript example" />
    </div>

    <div v-if="!runnable" class="api-example__static-result" aria-live="polite">
      <p>This example needs Node.js.</p>
      <OutputPanel :value="result" />
    </div>

    <div v-if="runnable && state === 'ready'" class="api-example__result" aria-live="polite">
      <aside class="api-example__tabs" aria-label="Result view">
        <button :class="{ '-active': activeTab === 'output' }" @click="activeTab = 'output'">Output</button>
        <button :class="{ '-active': activeTab === 'console' }" @click="activeTab = 'console'">Console <span v-if="logs.length" class="api-example__count">{{ logs.length }}</span></button>
        <button :class="{ '-active': activeTab === 'problems' }" @click="activeTab = 'problems'">Problems <span v-if="problemsCount" class="api-example__count" data-error>{{ problemsCount }}</span></button>
      </aside>

      <div v-show="activeTab === 'output'" class="api-example__pane api-example__result-card">
        <OutputPanel :value="result" />
        <p v-if="error" class="api-example__error">{{ error }}</p>
      </div>

      <div v-show="activeTab === 'console'" class="api-example__pane api-example__console">
        <ul v-if="logs.length"><li v-for="(entry, index) in logs" :key="index"><span class="api-example__console-level" :data-level="entry.level">{{ entry.level }}</span><code>{{ entry.args.join(' ') }}</code></li></ul>
        <p v-else class="api-example__empty">No console output.</p>
      </div>

      <div v-show="activeTab === 'problems'" class="api-example__pane api-example__diagnostics">
        <ul v-if="problemsCount">
          <li v-for="diagnostic in diagnostics" :key="`${diagnostic.code}-${diagnostic.start}`">{{ diagnostic.message }}</li>
          <li v-for="(diagnostic, index) in typeDiagnostics" :key="`typescript-${index}`">{{ diagnostic.message }}</li>
        </ul>
        <p v-else class="api-example__empty">No problems detected.</p>
      </div>
    </div>

    <div v-if="confirmReset" class="api-example__confirm">
      <p>Reset the example to its default code?</p>
      <div class="api-example__confirm-actions">
        <button class="api-example__btn api-example__btn--text api-example__btn--danger" @click="reset">Confirm</button>
        <button class="api-example__btn api-example__btn--text" @click="confirmReset = false">Cancel</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.api-example { position: relative; margin: .8rem 0; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.api-example[data-execution="interactive"] {grid-column: 1 / -1;}
.api-example__bar { display: flex; align-items: center; gap: .3rem; height: 1.8rem; padding: 0 .45rem; border-bottom: 1px solid var(--vp-c-divider); }
.api-example__tab { display: inline-flex; align-items: center; color: var(--vp-c-text-3); font: 500 .7rem/1 var(--vp-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace); }
.api-example__spacer { flex: 1; }
.api-example__btn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 1.55rem; height: 1.55rem; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--vp-c-text-3); cursor: pointer; transition: background .16s ease, color .16s ease, transform .16s ease; }
.api-example__btn svg { width: .8rem; height: .8rem; }
.api-example__btn:hover:not(:disabled) { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.api-example__btn:active:not(:disabled) { transform: scale(.92); }
.api-example__btn:disabled { cursor: not-allowed; opacity: .45; }
.api-example__btn--primary { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.api-example__btn--primary:hover:not(:disabled) { color: var(--vp-c-brand-2); }
.api-example__btn--text { width: auto; height: auto; padding: .38rem .65rem; font: 600 .7rem/1 var(--vp-font-family-base, inherit); }
.api-example__btn--danger:hover:not(:disabled) { background: var(--vp-c-danger-soft); color: var(--vp-c-danger-1); }
.api-example__btn[data-tip]:hover::after,
.api-example__btn[data-tip]:focus-visible::after,
.api-example__activate[data-tip]:hover::after,
.api-example__activate[data-tip]:focus-visible::after {
  content: attr(data-tip);
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  z-index: 20;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: .28rem .5rem;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font: 500 .66rem/1 var(--vp-font-family-base, inherit);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, .08);
}
.api-example__body { position: relative; }
.api-example__editor { height: 11rem; }
.api-example__preview-wrap { position: relative; overflow: hidden; }
.api-example__preview-wrap .lang { position: absolute; top: .55rem; left: .8rem; z-index: 1; color: var(--vp-c-text-3); font: 600 .62rem/1 var(--vp-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace); letter-spacing: .04em; text-transform: lowercase; }
.api-example__preview { min-height: 11rem; max-height: 18rem; margin: 0; overflow: auto; padding: 1.65rem .8rem .8rem; background: transparent; color: var(--vp-c-text-1); font: .75rem/1.6 var(--vp-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace); }
.api-example__preview code { white-space: pre-wrap; }
.api-example__activate { position: absolute; top: .35rem; right: .45rem; z-index: 2; display: inline-flex; align-items: center; justify-content: center; width: 1.65rem; height: 1.65rem; border: 1px solid var(--vp-c-divider); border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-2); cursor: pointer; transition: background .16s ease, border-color .16s ease, color .16s ease, transform .16s ease; }
.api-example__activate svg { width: .88rem; height: .88rem; }
.api-example__activate:hover:not(:disabled), .api-example__activate:focus-visible { border-color: var(--vp-c-brand-2); background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.api-example__activate:active:not(:disabled) { transform: scale(.92); }
.api-example__activate:disabled { cursor: wait; opacity: .6; }
.api-example__load-error { position: absolute; right: .8rem; bottom: .65rem; left: .8rem; margin: 0; border-radius: 6px; padding: .28rem .55rem; background: var(--vp-c-danger-soft); color: var(--vp-c-danger-1); font: .72rem/1.4 var(--vp-font-family-mono, ui-monospace, Menlo, Consolas, monospace); text-align: center; }
.api-example__static-result { border-top: 1px solid var(--vp-c-divider); padding: .65rem .8rem .75rem; background: var(--vp-c-bg-alt); }
.api-example__static-result p { margin: 0 0 .55rem; color: var(--vp-c-text-3); font-size: .72rem; line-height: 1.45; }
.api-example__result { border-top: 1px solid var(--vp-c-divider); border-radius: 0 0 10px 10px; background: var(--vp-c-bg-alt); }
.api-example__tabs { display: flex; align-items: center; gap: .05rem; padding: .3rem .45rem 0; border-bottom: 1px solid var(--vp-c-divider); }
.api-example__tabs button { display: inline-flex; align-items: center; gap: .3rem; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; padding: .25rem .5rem .3rem; background: transparent; color: var(--vp-c-text-3); cursor: pointer; font: 500 .72rem/1 var(--vp-font-family-base, inherit); transition: color .16s ease, border-color .16s ease; }
.api-example__tabs button:hover { color: var(--vp-c-text-2); }
.api-example__tabs button.-active { color: var(--vp-c-brand-1); border-bottom-color: var(--vp-c-brand-1); }
.api-example__count { min-width: 1rem; border-radius: 999px; padding: .02rem .3rem; background: color-mix(in srgb, var(--vp-c-text-3) 18%, transparent); font: .58rem/1.2 var(--vp-font-family-mono, Menlo, Consolas, monospace); text-align: center; }
.api-example__count[data-error] { background: var(--vp-c-danger-soft); color: var(--vp-c-danger-1); }
.api-example__pane { padding: .6rem .8rem; }
.api-example__result-card { padding: .4rem .6rem; }
.api-example__empty { margin: 0; color: var(--vp-c-text-3); font-size: .74rem; }
.api-example__console ul, .api-example__diagnostics ul { display: flex; flex-direction: column; gap: .35rem; margin: 0; padding: 0; list-style: none; }
.api-example__console li { display: flex; align-items: baseline; gap: .5rem; min-width: 0; font: .72rem/1.45 var(--vp-font-family-mono, ui-monospace, Menlo, Consolas, monospace); }
.api-example__console-level { flex: 0 0 auto; min-width: 3.2rem; color: var(--vp-c-text-3); font-size: .58rem; letter-spacing: .04em; text-transform: uppercase; }
.api-example__console-level[data-level="error"] { color: var(--vp-c-danger-1); }
.api-example__console-level[data-level="warn"] { color: var(--vp-c-warning-1); }
.api-example__console code { overflow: hidden; color: var(--vp-c-text-1); text-overflow: ellipsis; white-space: pre-wrap; }
.api-example__diagnostics li { color: var(--vp-c-danger-1); font: .72rem/1.45 var(--vp-font-family-mono, ui-monospace, Menlo, Consolas, monospace); }
.api-example__error { margin: .55rem 0 0; border: 1px solid color-mix(in srgb, var(--vp-c-danger-1) 35%, transparent); border-radius: 6px; padding: .5rem .6rem; background: var(--vp-c-danger-soft); color: var(--vp-c-danger-1); font: .72rem/1.45 var(--vp-font-family-mono, ui-monospace, Menlo, Consolas, monospace); white-space: pre-wrap; }
.api-example__confirm { position: absolute; top: 2rem; right: .4rem; z-index: 5; display: flex; flex-direction: column; gap: .5rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: .6rem .7rem; background: var(--vp-c-bg); box-shadow: 0 8px 24px rgba(0, 0, 0, .12); }
.api-example__confirm p { margin: 0; font-size: .74rem; }
.api-example__confirm-actions { display: flex; gap: .35rem; justify-content: flex-end; }
</style>
