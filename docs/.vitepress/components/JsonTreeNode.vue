<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JsonValue } from '../runner/output.js'

defineOptions({ name: 'JsonTreeNode' })

const props = withDefaults(defineProps<{
  value: JsonValue
  label?: string
  labelKind?: 'property' | 'index'
  depth?: number
  path?: string
}>(), {
  labelKind: 'property',
  depth: 0,
  path: '$',
})

type JsonEntry = { key: string; value: JsonValue; path: string }

const isArray = computed(() => Array.isArray(props.value))
const isContainer = computed(() => typeof props.value === 'object' && props.value !== null)
const hasLabel = computed(() => props.label !== undefined)
const labelText = computed(() => {
  if (props.label === undefined) return ''
  return props.labelKind === 'index' ? `[${props.label}]` : `${JSON.stringify(props.label)}:`
})
const entries = computed<JsonEntry[]>(() => {
  if (Array.isArray(props.value)) {
    return props.value.map((value, index) => ({ key: String(index), value, path: `${props.path}[${index}]` }))
  }
  if (props.value !== null && typeof props.value === 'object') {
    return Object.entries(props.value).map(([key, value]) => ({ key, value, path: `${props.path}.${key}` }))
  }
  return []
})
const nodeKind = computed(() => {
  if (Array.isArray(props.value)) return 'array'
  if (props.value === null) return 'null'
  return typeof props.value
})
const open = ref(props.depth === 0)

function toggle(): void {
  open.value = !open.value
}
const opening = computed(() => isArray.value ? '[' : '{')
const closing = computed(() => isArray.value ? ']' : '}')
const itemLabel = computed(() => {
  if (isArray.value) return entries.value.length === 1 ? 'item' : 'items'
  return entries.value.length === 1 ? 'key' : 'keys'
})
const scalarText = computed(() => {
  if (typeof props.value === 'string') return JSON.stringify(props.value)
  if (props.value === null) return 'null'
  return String(props.value)
})

function childLabelKind(): 'property' | 'index' {
  return isArray.value ? 'index' : 'property'
}
</script>

<template>
  <div
    v-if="isContainer && entries.length === 0"
    class="json-node json-node--empty"
    :data-json-node="nodeKind"
    :data-json-depth="props.depth"
    :data-json-path="props.path"
  >
    <span v-if="hasLabel" class="json-node__key">{{ labelText }}</span>
    <span class="json-node__punctuation">{{ opening }}{{ closing }}</span>
  </div>

  <details
    v-else-if="isContainer"
    class="json-node json-node--container"
    :data-json-node="nodeKind"
    :data-json-depth="props.depth"
    :data-json-path="props.path"
    :open="open"
  >
    <summary class="json-node__summary" :aria-label="`Toggle ${labelText || 'root value'}`" @click.prevent="toggle">
      <span v-if="hasLabel" class="json-node__key">{{ labelText }}</span>
      <span class="json-node__punctuation">{{ opening }}</span>
      <span class="json-node__size">{{ entries.length }} {{ itemLabel }}</span>
    </summary>
    <div class="json-node__children">
      <JsonTreeNode
        v-for="entry in entries"
        :key="entry.path"
        :value="entry.value"
        :label="entry.key"
        :label-kind="childLabelKind()"
        :depth="props.depth + 1"
        :path="entry.path"
      />
    </div>
    <div class="json-node__closing"><span class="json-node__punctuation">{{ closing }}</span></div>
  </details>

  <div
    v-else
    class="json-node json-node--scalar"
    :data-json-node="nodeKind"
    :data-json-depth="props.depth"
    :data-json-path="props.path"
  >
    <span v-if="hasLabel" class="json-node__key">{{ labelText }}</span>
    <span :class="['json-node__value', `json-node__value--${nodeKind}`]">{{ scalarText }}</span>
  </div>
</template>

<style scoped>
.json-node { min-width: 0; color: var(--vp-c-text-1); font: .73rem/1.25 var(--vp-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace); }
.json-node__summary { display: flex; align-items: baseline; gap: .3rem; width: fit-content; max-width: 100%; border-radius: 4px; padding: 0 .2rem; cursor: pointer; list-style: none; outline: none; margin: 2px 0 }
.json-node__summary::-webkit-details-marker { display: none; }
.json-node__summary::before { display: inline-block; width: .75rem; color: var(--vp-c-text-3); content: '›'; font: 1rem/1 var(--vp-font-family-base, sans-serif); text-align: center; transition: transform .14s ease, color .14s ease; }
.json-node[open] > .json-node__summary::before { transform: rotate(90deg); color: var(--vp-c-brand-1); }
.json-node__summary:hover, .json-node__summary:focus-visible { background: var(--vp-c-brand-soft); }
.json-node__summary:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 36%, transparent); }
.json-node__key { color: var(--vp-c-brand-1); }
.json-node__punctuation { color: var(--vp-c-text-2); }
.json-node__size { color: var(--vp-c-text-3); font-size: .66rem; }
.json-node__children { margin-left: .88rem; border-left: 1px solid color-mix(in srgb, var(--vp-c-divider) 78%, transparent); padding: 0 0 0 .72rem; }
.json-node__closing { margin-left: 1.15rem; padding: 0 .2rem; margin-bottom:2px; }
.json-node--empty { min-height: 1.05rem; padding: 0 .2rem 0 1.15rem; }
.json-node--empty[data-json-depth="0"] { padding-left: .2rem; }
.json-node--scalar { min-height: 1.05rem; padding: 0 .2rem 0 1.15rem; }
.json-node__value--string { color: var(--vp-c-green-1, #40a02b); }
.json-node__value--number { color: var(--vp-c-orange-1, #fe640b); }
.json-node__value--boolean, .json-node__value--null { color: var(--vp-c-purple-1, #8839ef); }
[class^="json-node__value--"] {overflow-wrap: break-word}
</style>
