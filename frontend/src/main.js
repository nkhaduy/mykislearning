import './index.css'
import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { FrappeUI, setConfig, pageMetaPlugin } from 'frappe-ui'
import App from './App.vue'
import router from './router'
import translationPlugin from './translation'
import { compatibilityCall, resourceFetcher } from '@/backend'
import { usersStore } from '@/stores/user'
import { sessionStore } from '@/stores/session'
import { createDialog } from '@/utils/dialogs'
import dayjs from '@/utils/dayjs'

window.lms_path = ''
window.read_only_mode = false
window.translatedMessages = window.translatedMessages || {}
setConfig('resourceFetcher', resourceFetcher)

const pinia = createPinia()
const app = createApp(App)
app.use(FrappeUI, { call: compatibilityCall, socketio: false })
app.use(pinia)

async function bootstrap() {
	await sessionStore().initialize()
	app.use(router)
	app.use(translationPlugin)
	app.use(pageMetaPlugin)
	app.provide('$dayjs', dayjs)
	app.provide('$socket', { on() {}, off() {}, emit() {} })
	const { userResource, allUsers } = usersStore()
	if (sessionStore().isLoggedIn) await userResource.reload()
	app.provide('$user', userResource)
	app.provide('$allUsers', allUsers)
	app.config.globalProperties.$user = userResource
	app.config.globalProperties.$dialog = createDialog
	watch(() => sessionStore().user, (value) => { if (value) userResource.reload(); else userResource.reset() })
	app.mount('#app')
}

bootstrap()
