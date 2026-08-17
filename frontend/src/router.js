import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from './stores/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'Login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/', redirect: '/courses' },
    { path: '/courses', name: 'Courses', component: () => import('./views/CoursesView.vue') },
    { path: '/courses/:id', name: 'Course', component: () => import('./views/CourseView.vue') },
    { path: '/courses/:courseId/lessons/:lessonId', name: 'Lesson', component: () => import('./views/LessonView.vue') },
    { path: '/admin', name: 'Admin', component: () => import('./views/AdminView.vue'), meta: { hr: true } },
  ],
})

router.beforeEach((to) => {
  const store = useSessionStore()
  if (!to.meta.public && !store.session) return { name: 'Login', query: { next: to.fullPath } }
  if (to.meta.hr && !store.isHr) return { name: 'Courses' }
  if (to.name === 'Login' && store.session) return { name: 'Courses' }
})

export default router
