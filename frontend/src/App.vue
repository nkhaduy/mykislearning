<template>
	<router-view v-if="route.meta.public" />
	<FrappeUIProvider v-else>
		<Layout class="isolate text-p-base"><router-view /></Layout>
		<NotificationPanel />
		<Dialogs />
	</FrappeUIProvider>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FrappeUIProvider } from 'frappe-ui'
import { Dialogs } from '@/utils/dialogs'
import { useScreenSize } from '@/utils/composables'
import DesktopLayout from '@/components/Layouts/DesktopLayout.vue'
import MobileLayout from '@/components/Layouts/MobileLayout.vue'
import NoSidebarLayout from '@/components/Layouts/NoSidebarLayout.vue'
import NotificationPanel from '@/components/Notifications/NotificationPanel.vue'

const route = useRoute()
const { isMobile } = useScreenSize()
const Layout = computed(() => route.query.fromLesson ? NoSidebarLayout : isMobile.value ? MobileLayout : DesktopLayout)
</script>
