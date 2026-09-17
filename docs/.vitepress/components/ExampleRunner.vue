<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import OutputPanel from './OutputPanel.vue'
import { lintExample, type LintDiagnostic } from '../runner/docs-linter.js'
import { configureMonacoWorkers } from '../runner/monaco-environment.js'
import { configureMonacoTypes } from '../runner/monaco-types.js'
import { clearExampleSession, readExampleSession, writeExampleSession, type ExampleSession } from '../runner/example-session.js'
import { defineMonacoThemes } from '../runner/monaco-theme.js'

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

function readSession(): ExampleSession | undefined {
  return readExampleSession(storageKey.value)
}

function writeSession() {
  writeExampleSession(storageKey.value, source.value)
}

function clearSession() {
  clearExampleSession(storageKey.value)
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
    defineMonacoThemes(monaco)
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
