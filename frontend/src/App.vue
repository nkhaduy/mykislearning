<template>
  <div class="app-shell">
    <aside v-if="session.session" class="sidebar">
      <RouterLink class="brand" to="/courses">
        <span class="brand-mark">K</span>
        <span><strong>KIS Learning</strong><small>Frappe LMS</small></span>
      </RouterLink>
      <nav>
        <RouterLink to="/courses"><BookOpen :size="18" />Courses</RouterLink>
        <RouterLink v-if="session.isHr" to="/admin"><SquarePen :size="18" />Course editor</RouterLink>
      </nav>
      <div class="sidebar-user">
        <div><strong>{{ session.profile?.full_name }}</strong><small>{{ session.profile?.role }}</small></div>
        <Button variant="subtle" @click="leave"><LogOut :size="16" /><span>Log out</span></Button>
      </div>
    </aside>
    <main class="main"><RouterView /></main>
  </div>
</template>

<script setup>
import { BookOpen, LogOut, SquarePen } from 'lucide-vue-next'
import Button from '@frappe/Button'
import { useRouter } from 'vue-router'
import { useSessionStore } from './stores/session'

const session = useSessionStore()
const router = useRouter()
async function leave() { await session.signOut(); router.replace('/login') }
</script>
