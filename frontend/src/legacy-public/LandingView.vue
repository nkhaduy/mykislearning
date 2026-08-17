<template><div ref="root" class="legacy-public-host" /></template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import fontHref from './styles/font.css?url'
import homeHref from './styles/home.css?url'
import { mountLegacyHome } from './runtime/home'
import { attachLegacyStyles } from './style-links'

const root = ref(null)
let cleanupPage = () => {}
let cleanupStyles = () => {}

onMounted(() => {
  document.title = 'MyKIS Learning | Trung tâm học tập nội bộ KIS'
  cleanupStyles = attachLegacyStyles([fontHref, homeHref])
  cleanupPage = mountLegacyHome(root.value)
})

onBeforeUnmount(() => {
  cleanupPage()
  cleanupStyles()
})
</script>
