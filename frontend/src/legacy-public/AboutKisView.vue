<template><div ref="root" class="legacy-public-host" /></template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import fontHref from './styles/font.css?url'
import homeHref from './styles/home.css?url'
import aboutHref from './styles/about.css?url'
import { mountLegacyAbout } from './runtime/about'
import { attachLegacyStyles } from './style-links'

const root = ref(null)
let cleanupPage = () => {}
let cleanupStyles = () => {}

onMounted(() => {
  cleanupStyles = attachLegacyStyles([fontHref, homeHref, aboutHref])
  cleanupPage = mountLegacyAbout(root.value)
})

onBeforeUnmount(() => {
  cleanupPage()
  cleanupStyles()
})
</script>
