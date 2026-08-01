<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

const route = useRoute()
const isApiPage = computed(() => route.path.startsWith('/api/generated'))
</script>

<template>
  <div :class="isApiPage ? 'api-page' : undefined">
    <DefaultTheme.Layout />
  </div>
</template>
