import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from './stores/session'
import { safeProtectedDestination } from './routing/policy'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'Landing', component: () => import('./legacy-public/LandingView.vue'), meta: { public: true } },
    { path: '/about', redirect: '/about-kis' },
    { path: '/about-kis', name: 'AboutKis', component: () => import('./legacy-public/AboutKisView.vue'), meta: { public: true } },
    { path: '/login', name: 'Login', component: () => import('./legacy-public/LoginView.vue'), meta: { public: true } },
    { path: '/courses', name: 'Courses', component: () => import('./views/CoursesView.vue') },
    { path: '/courses/:id', name: 'Course', component: () => import('./views/CourseView.vue') },
    { path: '/courses/:courseId/lessons/:lessonId', name: 'Lesson', component: () => import('./views/LessonView.vue') },
    { path: '/admin', name: 'Admin', component: () => import('./views/AdminView.vue'), meta: { hr: true } },
  ],
})

router.beforeEach((to) => {
  const store = useSessionStore()
  if (!to.meta.public && !store.session) return { name: 'Login', query: { next: safeProtectedDestination(to.fullPath) } }
  if (to.meta.hr && !store.isHr) return { name: 'Courses' }
  if (to.name === 'Login' && store.session) return { name: 'Courses' }
})

export default router
