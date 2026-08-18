import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { createResource } from 'frappe-ui'
import { supabase } from '@/data/supabase/client'
import { syncFrappeSessionCookie } from '@/backend/auth'

export const sessionStore = defineStore('lms-session', () => {
	const user = ref(null)
	const isLoggedIn = computed(() => Boolean(user.value))
	const brand = reactive({ name: 'KIS Learning', logo: '/legacy-public/assets/kis-logo-horizontal.png', favicon: '/favicon.ico' })

	async function initialize() {
		const { data } = await supabase.auth.getSession()
		user.value = data.session?.user?.email || null
		syncFrappeSessionCookie(user.value)
		supabase.auth.onAuthStateChange((_event, session) => {
			user.value = session?.user?.email || null
			syncFrappeSessionCookie(user.value)
		})
	}

	async function signIn(email, password) {
		const { data, error } = await supabase.auth.signInWithPassword({ email, password })
		if (error) throw error
		user.value = data.session?.user?.email || null
		syncFrappeSessionCookie(user.value)
		return data.session
	}

	const logout = createResource({
		url: 'logout',
		async onSuccess() {
			user.value = null
			syncFrappeSessionCookie(null)
			window.location.assign('/login')
		},
	})
	const branding = createResource({ url: 'lms.lms.api.get_branding', auto: true, onSuccess(data) { Object.assign(brand, { name: data.app_name, logo: data.app_logo, favicon: data.favicon?.file_url || '/favicon.ico' }) } })

	return { user, isLoggedIn, logout, brand, branding, initialize, signIn }
})

export const useSessionStore = sessionStore
