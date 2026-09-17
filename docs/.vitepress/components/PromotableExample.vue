<script setup lang="ts">
import { ref } from 'vue'
import ExampleRunner from './ExampleRunner.vue'

const props = withDefaults(defineProps<{
  id?: string
  code: string
  execution?: 'interactive' | 'interactive-with-limitation' | 'interactive-fixture' | 'static-node-only'
  title?: string
  output?: string
  fixture?: string
}>(), { execution: 'interactive', fixture: 'realm-docs' })

const activated = ref(false)

function activate() {
  if (props.execution !== 'static-node-only') activated.value = true
}
</script>

<template>
  <div v-if="!activated" :id="id" class="promotable-example">
    <div class="promotable-example__preview">
      <slot />
      <button
        v-if="execution !== 'static-node-only'"
        class="promotable-example__activate"
        type="button"
        aria-label="Open this example in the runnable editor"
        data-tip="Open in runnable editor"
        @click="activate"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.25 3.35a.75.75 0 0 1 1.14-.64l7.2 4.65a.75.75 0 0 1 0 1.28l-7.2 4.65a.75.75 0 0 1-1.14-.64z" /></svg>
      </button>
    </div>
  </div>
  <ExampleRunner
    v-else
    :id="id"
    :code="code"
    :execution="execution"
    :title="title"
    :output="output"
    :fixture="fixture"
    initially-active
  />
</template>

<style scoped>
.promotable-example { position: relative; }
.promotable-example__preview { position: relative; }
.promotable-example__preview :deep([class*='language-']) { position: relative; }
.promotable-example__activate {
  position: absolute;
  top: 12px;
  right: 60px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--vp-code-copy-code-border-color);
  border-radius: 4px;
  background-color: var(--vp-code-copy-code-bg);
  color: var(--vp-c-text-3);
  cursor: pointer;
  opacity: 0;
  transition: border-color .25s, background-color .25s, color .16s ease, opacity .25s, transform .16s ease;
}
.promotable-example__preview:hover .promotable-example__activate,
.promotable-example__activate:focus-visible { opacity: 1; }
.promotable-example__preview:hover :deep([class*='language-'] > button.copy) { opacity: 1; }
.promotable-example__activate svg { width: 20px; height: 20px; }
.promotable-example__activate:hover,
.promotable-example__activate:focus-visible {
  border-color: var(--vp-code-copy-code-hover-border-color);
  background-color: var(--vp-code-copy-code-hover-bg);
  color: var(--vp-c-brand-1);
}
.promotable-example__activate:active { transform: scale(.92); }
.promotable-example__activate[data-tip]::after {
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  z-index: 5;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: .28rem .5rem;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  content: attr(data-tip);
  font: 500 .66rem/1 var(--vp-font-family-base, inherit);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, .08);
  opacity: 0;
  transition: opacity .16s ease;
}
.promotable-example__activate:hover::after,
.promotable-example__activate:focus-visible::after { opacity: 1; }
</style>
