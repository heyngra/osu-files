<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ source: string; startLine: number; endLine: number }>()
const href = computed(() => {
  const lines = props.startLine === props.endLine ? `#L${props.startLine}` : `#L${props.startLine}-L${props.endLine}`
  return `https://github.com/heyngra/osu-files/blob/${__GIT_REVISION__}/${props.source}${lines}`
})
</script>

<template>
  <div class="guide-source">
    <slot />
    <a
      class="guide-source__link"
      :href="href"
      target="_blank"
      rel="noreferrer"
      aria-label="View these lines on GitHub"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M6.25 3.25h-3v9.5h9.5v-3" />
        <path d="M8.25 3.25h4.5v4.5M12.5 3.5l-6 6" />
      </svg>
      <span>View source</span>
    </a>
  </div>
</template>

<style scoped>
.guide-source {
  position: relative;
}

.guide-source__link {
  position: absolute;
  top: 12px;
  right: 51px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 40px;
  border: 1px solid var(--vp-code-copy-code-border-color);
  border-radius: 4px 0 0 4px;
  padding: 0 11px;
  background: var(--vp-code-copy-code-bg);
  color: var(--vp-c-text-3);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  opacity: 0;
  transition: border-color .25s, background-color .25s, color .16s ease, opacity .25s, transform .16s ease;
}

.guide-source :deep([class*='language-'] > button.copy) {
  border-radius: 0 4px 4px 0;
}

.guide-source:hover .guide-source__link,
.guide-source:focus-within .guide-source__link,
.guide-source:hover :deep([class*='language-'] > button.copy),
.guide-source:focus-within :deep([class*='language-'] > button.copy) {
  opacity: 1;
}

.guide-source__link:hover,
.guide-source__link:focus-visible {
  border-color: var(--vp-code-copy-code-hover-border-color);
  background: var(--vp-code-copy-code-hover-bg);
  color: var(--vp-c-brand-1);
}

.guide-source__link:active {
  transform: scale(.96);
}

.guide-source__link svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 520px) {
  .guide-source__link {
    width: 40px;
    padding: 0;
    justify-content: center;
  }

  .guide-source__link span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
}
</style>
