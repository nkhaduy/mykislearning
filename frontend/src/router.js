import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/data/supabase/client'
import { safeProtectedDestination } from '@/routing/policy'

const routes = [
	{ path: '/', name: 'Landing', component: () => import('@/legacy-public/LandingView.vue'), meta: { public: true } },
	{ path: '/about', redirect: '/about-kis' },
	{ path: '/about-kis', name: 'AboutKis', component: () => import('@/legacy-public/AboutKisView.vue'), meta: { public: true } },
	{ path: '/login', name: 'Login', component: () => import('@/legacy-public/LoginView.vue'), meta: { public: true } },
	{ path: '/courses', name: 'Courses', component: () => import('@/pages/Courses/Courses.vue') },
	{ path: '/courses/:courseName', name: 'CourseDetail', component: () => import('@/pages/Courses/CourseDetail.vue'), props: true },
	{ path: '/courses/:courseName/learn/:chapterNumber-:lessonNumber', name: 'Lesson', component: () => import('@/pages/Lesson.vue'), props: true },
	{ path: '/courses/:courseId/lessons/:lessonId', redirect: async (to) => legacyLessonTarget(to.params.courseId, to.params.lessonId) },
	{ path: '/user/:username', name: 'Profile', component: () => import('@/pages/Profile.vue'), props: true, redirect: { name: 'ProfileAbout' }, children: [
		{ name: 'ProfileAbout', path: '', component: () => import('@/pages/ProfileAbout.vue') },
		{ name: 'ProfileCertificates', path: 'certificates', component: () => import('@/pages/ProfileCertificates.vue') },
	] },
	{ path: '/admin', redirect: { name: 'Courses', query: { tab: 'created' } } },
	{ path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('@/pages/NotFound.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
	const { data } = await supabase.auth.getSession()
	const loggedIn = Boolean(data.session)
	if (to.meta.public) {
		if (to.name === 'Login' && loggedIn) return { name: 'Courses' }
		return true
	}
	if (!loggedIn) return { name: 'Login', query: { next: safeProtectedDestination(to.fullPath) } }
	return true
})

async function legacyLessonTarget(courseId, lessonId) {
	const { data } = await supabase.from('chapters').select('id,sort_order,lessons(id,sort_order)').eq('course_id', courseId).order('sort_order').order('sort_order', { referencedTable: 'lessons' })
	for (let chapterIndex = 0; chapterIndex < (data || []).length; chapterIndex += 1) {
		const lessonIndex = (data[chapterIndex].lessons || []).findIndex((lesson) => lesson.id === lessonId)
		if (lessonIndex >= 0) return { name: 'Lesson', params: { courseName: courseId, chapterNumber: chapterIndex + 1, lessonNumber: lessonIndex + 1 } }
	}
	return { name: 'CourseDetail', params: { courseName: courseId } }
}

export default router
