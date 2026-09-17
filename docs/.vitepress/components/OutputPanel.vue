<script setup lang="ts">
import { computed } from 'vue'
import JsonTreeNode from './JsonTreeNode.vue'
import { parseSerializedOutput } from '../runner/output.js'

const props = withDefaults(defineProps<{ title?: string; value?: string }>(), { value: '' })
const parsed = computed(() => parseSerializedOutput(props.value))
</script>

<template>
  <div class="output-panel" data-json-output>
    <small class="output-panel__title">{{ props.title ?? 'Returned value' }}</small>
    <JsonTreeNode v-if="parsed.kind === 'json'" :value="parsed.value" />
    <pre v-else class="output-panel__fallback">{{ parsed.value }}</pre>
  </div>
</template>

<style scoped>
.output-panel { min-width: 0; }
.output-panel__title { display: block; margin-bottom: .2rem; color: var(--vp-c-text-3); font-size: .64rem; letter-spacing: .04em; text-transform: uppercase; }
.output-panel__fallback { max-height: 10rem; margin: 0; overflow: auto; white-space: pre-wrap; color: var(--vp-c-text-1); font: .74rem/1.55 var(--vp-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace); }
</style>
