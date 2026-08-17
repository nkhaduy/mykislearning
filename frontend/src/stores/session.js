import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSession, login, logout, onAuthStateChange } from '../data/supabase/auth'
import { getMyProfile } from '../data/supabase/profiles'

export const useSessionStore = defineStore('session', () => {
  const session = ref(null)
  const profile = ref(null)
  const ready = ref(false)
  const isHr = computed(() => profile.value?.role?.toLowerCase() === 'hr')

  async function refreshProfile() {
    profile.value = session.value ? await getMyProfile() : null
  }

  async function initialize() {
    const { data } = await getSession()
    session.value = data.session
    if (session.value) await refreshProfile()
    onAuthStateChange(async (_event, nextSession) => {
      session.value = nextSession
      await refreshProfile()
    })
    ready.value = true
  }

  async function signIn(email, password) {
    const { data, error } = await login(email, password)
    if (error) throw error
    session.value = data.session
    await refreshProfile()
  }

  async function signOut() {
    await logout()
    session.value = null
    profile.value = null
  }

  return { session, profile, ready, isHr, initialize, signIn, signOut }
})
