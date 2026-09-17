<script setup lang="ts">
defineProps<{ name: string; kind: string; href: string; signature?: string; interactive?: boolean }>()
</script>
<template><a class="api-card" :href="href"><span class="api-card__kind">{{ kind }}</span><strong class="api-card__name">{{ name }}</strong><code v-if="signature" class="api-card__signature">{{ signature }}</code><small>{{ interactive ? 'Interactive example available' : 'Node reference' }}</small></a></template>

<style scoped>
.api-card {
  display: flex;
  min-height: 8.5rem;
  flex-direction: column;
  gap: .55rem;
  padding: 1.1rem 1.15rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}
.api-card:hover { border-color: var(--vp-c-brand-1); box-shadow: 0 8px 24px rgb(0 0 0 / 8%); transform: translateY(-2px); }
.api-card__kind { color: var(--vp-c-brand-1); font-size: .72rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.api-card__name { font-size: 1.05rem; }
.api-card__signature { width: fit-content; max-width: 100%; overflow: hidden; border-radius: 4px; padding: .25rem .4rem; background: var(--vp-code-block-bg); color: var(--vp-code-color); text-overflow: ellipsis; white-space: nowrap; }
.api-card small { margin-top: auto; color: var(--vp-c-text-2); font-size: .78rem; }
</style>
