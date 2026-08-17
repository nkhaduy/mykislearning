<template>
  <div class="login-page">
    <section class="login-card">
      <div class="brand-mark large">K</div>
      <p class="eyebrow">KIS VIETNAM</p>
      <h1>Welcome to Learning</h1>
      <p class="muted">Sign in with your company learning account.</p>
      <form @submit.prevent="submit">
        <FormControl v-model="email" type="email" label="Email" required />
        <FormControl v-model="password" type="password" label="Password" required />
        <ErrorMessage :message="error" />
        <Button type="submit" variant="solid" theme="gray" size="lg" :loading="loading" class="full">Sign in</Button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Button from '@frappe/Button'
import ErrorMessage from '@frappe/ErrorMessage'
import FormControl from '@frappe/FormControl'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
const email = ref(''); const password = ref(''); const error = ref(''); const loading = ref(false)
const store = useSessionStore(); const router = useRouter(); const route = useRoute()
async function submit() {
  loading.value = true; error.value = ''
  try { await store.signIn(email.value, password.value); await router.replace(route.query.next || '/courses') }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}
</script>
