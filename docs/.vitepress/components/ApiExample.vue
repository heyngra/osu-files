<script setup lang="ts">
import ExampleRunner from './ExampleRunner.vue'
defineProps<{ id?: string; code: string; execution?: 'interactive' | 'interactive-with-limitation' | 'static-node-only'; title?: string }>()
</script>
<template><ExampleRunner :id="id" :code="code" :execution="execution" :title="title" /></template>
