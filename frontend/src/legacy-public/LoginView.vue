<template>
  <main class="auth-page legacy-login-page">
    <div class="auth-backdrop" aria-hidden="true" />
    <RouterLink class="auth-home-link" to="/"><span aria-hidden="true">‹</span>{{ t.home }}</RouterLink>
    <section class="auth-context" aria-hidden="true">
      <div><p>{{ t.title }}</p><span>{{ t.subtitle }}</span></div>
    </section>
    <section class="auth-panel">
      <form class="auth-card" autocomplete="on" :aria-busy="loading" @submit.prevent="submit">
        <div class="auth-card-head">
          <RouterLink to="/" class="auth-logo-link" :aria-label="t.home">
            <img src="/legacy-public/assets/kis-logo-horizontal.png" alt="KIS Vietnam" width="700" height="92">
          </RouterLink>
          <div class="auth-language-switcher" role="group" aria-label="Language">
            <button v-for="code in languages" :key="code" type="button" :class="{ active: language === code }" :aria-pressed="language === code" @click="setLanguage(code)">{{ code.toUpperCase() }}</button>
          </div>
        </div>
        <h1>{{ t.formTitle }}</h1>
        <p v-if="destination !== '/courses'" class="auth-destination">{{ t.destination }} <strong>{{ t.destinationLabel }}</strong>.</p>
        <label>
          {{ t.email }}
          <input v-model.trim="email" type="email" inputmode="email" autocomplete="email" :placeholder="t.emailPlaceholder" required>
          <span class="auth-error" aria-live="polite">{{ validation === 'email' ? t.invalidEmail : '' }}</span>
        </label>
        <label>
          {{ t.password }}
          <span class="auth-password-wrap">
            <input v-model="password" :type="passwordVisible ? 'text' : 'password'" autocomplete="current-password" :placeholder="t.passwordPlaceholder" required>
            <button type="button" :aria-label="passwordVisible ? t.hide : t.show" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.75"/></svg>
            </button>
          </span>
          <span class="auth-error" aria-live="polite">{{ validation === 'password' ? t.missingPassword : '' }}</span>
        </label>
        <div class="auth-options">
          <label class="auth-remember"><input type="checkbox" checked> <span>{{ t.remember }}</span></label>
          <a class="auth-link" :href="supportHref">{{ t.support }}</a>
        </div>
        <p v-if="errorCode" class="auth-error" role="alert">{{ t.errors[errorCode] }}</p>
        <button class="auth-btn auth-btn-primary auth-submit" type="submit" :disabled="loading">{{ loading ? t.signingIn : t.submit }}</button>
        <p class="auth-note">{{ t.note }}<br><small>{{ t.rememberNote }}</small></p>
      </form>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'
import { safeProtectedDestination } from '../routing/policy'
import { attachLegacyStyles } from './style-links'
import { loginErrorCode } from './login-error'
import { submitLogin } from './login-submit'
import fontHref from './styles/font.css?url'
import authHref from './styles/auth.css?url'
import authVisualHref from './styles/auth-visual.css?url'

const copy = {
  vi: { home: 'Về trang chủ', title: 'Đăng nhập MyKIS Learning', formTitle: 'Đăng nhập', subtitle: 'Nền tảng Học tập và Phát triển năng lực dành riêng cho nhân viên KIS Việt Nam', email: 'Email', emailPlaceholder: 'Nhập email công ty', password: 'Mật khẩu', passwordPlaceholder: 'Nhập mật khẩu', remember: 'Ghi nhớ đăng nhập trên thiết bị này', rememberNote: 'Không nên bật trên máy dùng chung.', submit: 'Đăng nhập', signingIn: 'Đang đăng nhập...', support: 'Bạn không thể đăng nhập?', note: 'Tài khoản được cấp bởi bộ phận Nhân sự.', invalidEmail: 'Vui lòng nhập email công ty hợp lệ.', missingPassword: 'Vui lòng nhập mật khẩu.', show: 'Hiện mật khẩu', hide: 'Ẩn mật khẩu', destination: 'Sau khi đăng nhập, bạn sẽ tiếp tục tới', destinationLabel: 'nội dung học tập', supportSubject: 'Yêu cầu hỗ trợ đăng nhập MyKIS Learning', supportBody: 'Vui lòng hỗ trợ tôi đăng nhập MyKIS Learning.', errors: { invalid: 'Thông tin đăng nhập không chính xác.', rate: 'Có quá nhiều lần đăng nhập. Vui lòng chờ một lúc rồi thử lại.', system: 'Không thể đăng nhập lúc này. Vui lòng thử lại hoặc liên hệ bộ phận hỗ trợ nội bộ.' } },
  en: { home: 'Back to home', title: 'Sign in to MyKIS Learning', formTitle: 'Sign in', subtitle: 'Learning and capability development for KIS Vietnam employees', email: 'Email', emailPlaceholder: 'Enter company email', password: 'Password', passwordPlaceholder: 'Enter your password', remember: 'Remember me on this device', rememberNote: 'Do not enable on shared devices.', submit: 'Sign in', signingIn: 'Signing in...', support: "Can't sign in?", note: 'Accounts are provided by Human Resources.', invalidEmail: 'Enter a valid company email.', missingPassword: 'Enter your password.', show: 'Show password', hide: 'Hide password', destination: 'After signing in, you will continue to', destinationLabel: 'your learning content', supportSubject: 'MyKIS Learning sign-in support', supportBody: 'Please help me access MyKIS Learning.', errors: { invalid: 'Invalid sign-in details.', rate: 'Too many sign-in attempts. Wait a moment and try again.', system: 'Sign-in is unavailable. Please try again or contact internal support.' } },
  kr: { home: '홈으로', title: 'MyKIS Learning 로그인', formTitle: '로그인', subtitle: 'KIS Vietnam 임직원 전용 학습 및 역량 개발 플랫폼', email: '이메일', emailPlaceholder: '회사 이메일 입력', password: '비밀번호', passwordPlaceholder: '비밀번호 입력', remember: '이 기기에서 로그인 유지', rememberNote: '공용 기기에서는 사용하지 마세요.', submit: '로그인', signingIn: '로그인 중...', support: '로그인에 문제가 있나요?', note: '계정은 인사부에서 발급합니다.', invalidEmail: '유효한 회사 이메일을 입력해 주세요.', missingPassword: '비밀번호를 입력해 주세요.', show: '비밀번호 표시', hide: '비밀번호 숨기기', destination: '로그인 후 다음 위치로 이동합니다', destinationLabel: '학습 콘텐츠', supportSubject: 'MyKIS Learning 로그인 지원', supportBody: 'MyKIS Learning 로그인 지원을 요청합니다.', errors: { invalid: '로그인 정보가 올바르지 않습니다.', rate: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.', system: '로그인할 수 없습니다. 다시 시도하거나 내부 지원팀에 문의해 주세요.' } },
}

const languages = ['vi', 'en', 'kr']
const savedLanguage = localStorage.getItem('mykis-language')
const language = ref(languages.includes(savedLanguage) ? savedLanguage : 'vi')
const email = ref('')
const password = ref('')
const passwordVisible = ref(false)
const validation = ref('')
const errorCode = ref('')
const loading = ref(false)
const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const destination = computed(() => safeProtectedDestination(route.query.next))
const t = computed(() => copy[language.value])
const supportHref = computed(() => `mailto:thanh.ntc@kisvn.vn?subject=${encodeURIComponent(t.value.supportSubject)}&body=${encodeURIComponent(t.value.supportBody)}`)
let cleanupStyles = () => {}

function setLanguage(code) {
  language.value = code
  localStorage.setItem('mykis-language', code)
}

watch(language, (code) => { document.documentElement.lang = code === 'kr' ? 'ko' : code }, { immediate: true })

async function submit() {
  validation.value = !email.value ? 'email' : !password.value ? 'password' : ''
  if (validation.value) return
  loading.value = true
  errorCode.value = ''
  try {
    await submitLogin({ session, router, destination: destination.value, email: email.value, password: password.value })
  } catch (error) {
    errorCode.value = loginErrorCode(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  document.title = t.value.title
  cleanupStyles = attachLegacyStyles([fontHref, authHref, authVisualHref])
})
onBeforeUnmount(() => cleanupStyles())
</script>
