import { supabase } from '@/data/supabase/client'
import { toFrappeCourse, toFrappeLessonContent, toFrappeOutline, toFrappeUser } from './contracts'

const courseColumns = 'id,title,short_description,description,image_url,published,self_enroll_enabled,category,status,created_at'

async function currentProfile() {
	const { data: auth, error: authError } = await supabase.auth.getUser()
	if (authError) throw authError
	const { data, error } = await supabase.from('profiles').select('*').eq('auth_user_id', auth.user.id).single()
	if (error) throw error
	return data
}

async function courseMembership(courseId) {
	const profile = await currentProfile()
	const { data } = await supabase.from('enrollments').select('*').eq('course_id', courseId).eq('account_id', profile.id).maybeSingle()
	if (!data) return null
	const { data: progress } = await supabase.from('lesson_progress').select('lesson_id').eq('course_id', courseId).eq('completed', true)
	const { count } = await supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('course_id', courseId)
	return { name: data.id, member: profile.id, progress: count ? ((progress?.length || 0) / count) * 100 : 0 }
}

async function listCourses(params = {}) {
	let query = supabase.from('courses').select(courseColumns).order('created_at', { ascending: false })
	const filters = params.filters || {}
	if (filters.category) query = query.eq('category', filters.category)
	if (Array.isArray(filters.title)) query = query.ilike('title', filters.title[1])
	const start = Number(params.limit_start || params.start || 0)
	const limit = Number(params.limit_page_length || params.limit || 24)
	query = query.range(start, start + limit - 1)
	const { data, error } = await query
	if (error) throw error
	return Promise.all((data || []).map(async (course) => toFrappeCourse(course, { membership: await courseMembership(course.id) })))
}

async function getCourse(courseId) {
	const { data, error } = await supabase.from('courses').select(courseColumns).eq('id', courseId).single()
	if (error) throw error
	const profile = await currentProfile()
	const instructor = String(profile.role).toLowerCase() === 'hr' ? [toFrappeUser(profile)] : []
	return toFrappeCourse(data, { membership: await courseMembership(courseId), instructors: instructor })
}

async function getOutline(courseId, withProgress = false) {
	const { data, error } = await supabase.from('chapters').select('id,title,sort_order,lessons(id,title,sort_order,is_preview,published)').eq('course_id', courseId).order('sort_order').order('sort_order', { referencedTable: 'lessons' })
	if (error) throw error
	let completed = new Set()
	if (withProgress) {
		const { data: rows } = await supabase.from('lesson_progress').select('lesson_id').eq('course_id', courseId).eq('completed', true)
		completed = new Set((rows || []).map((row) => row.lesson_id))
	}
	return toFrappeOutline(data, completed)
}

async function getLesson(params) {
	const outline = await getOutline(params.course, true)
	const chapter = outline[Number(params.chapter) - 1]
	const lessonRef = chapter?.lessons?.[Number(params.lesson) - 1]
	if (!lessonRef) return {}
	const { data, error } = await supabase.from('lessons').select('*').eq('id', lessonRef.name).single()
	if (error) throw error
	const membership = await courseMembership(params.course)
	const lessonContent = toFrappeLessonContent(data.content)
	return {
		name: data.id, title: data.title, course: params.course, course_title: params.course,
		chapter_name: chapter.name, chapter_title: chapter.title, ...lessonContent,
		instructor_content: null, membership, progress: lessonRef.completed,
		prev: Number(params.lesson) > 1 ? `${params.chapter}.${Number(params.lesson) - 1}` : null,
		next: Number(params.lesson) < chapter.lessons.length ? `${params.chapter}.${Number(params.lesson) + 1}` : null,
	}
}

async function setValue({ doctype, name, fieldname, value }) {
	const values = typeof fieldname === 'string' ? { [fieldname]: value } : fieldname
	if (doctype === 'LMS Course') {
		const mapped = {}
		for (const [key, val] of Object.entries(values || {})) {
			const column = { short_introduction: 'short_description', image: 'image_url' }[key] || key
			if (['title', 'short_description', 'description', 'image_url', 'published', 'self_enroll_enabled', 'category'].includes(column)) mapped[column] = val
		}
		if (mapped.published !== undefined) mapped.status = mapped.published ? 'published' : 'draft'
		const { error } = await supabase.from('courses').update(mapped).eq('id', name)
		if (error) throw error
		return getCourse(name)
	}
	if (doctype === 'Course Lesson') {
		const mapped = {}
		if (values.title !== undefined) mapped.title = values.title
		if (values.content !== undefined) mapped.content = typeof values.content === 'string' ? JSON.parse(values.content) : values.content
		if (values.include_in_preview !== undefined) mapped.is_preview = Boolean(values.include_in_preview)
		if (values.published !== undefined) mapped.published = Boolean(values.published)
		const { data, error } = await supabase.from('lessons').update(mapped).eq('id', name).select().single()
		if (error) throw error
		return { ...data, name: data.id }
	}
	return null
}

async function insertDoc(doc) {
	if (doc.doctype === 'LMS Course') {
		const id = crypto.randomUUID()
		const profile = await currentProfile()
		const payload = { id, title: doc.title, short_description: doc.short_introduction, description: doc.description, image_url: doc.image || null, category: doc.category || null, published: false, self_enroll_enabled: true, status: 'draft', created_by: profile.id, data: {} }
		const { data, error } = await supabase.from('courses').insert(payload).select().single()
		if (error) throw error
		return toFrappeCourse(data)
	}
	if (doc.doctype === 'LMS Enrollment') {
		const profile = await currentProfile()
		const courseId = doc.course || doc.course_id
		const payload = { id: `${courseId}:${profile.id}`, course_id: courseId, account_id: profile.id }
		const { data, error } = await supabase.from('enrollments').upsert(payload, { onConflict: 'course_id,account_id' }).select().single()
		if (error) throw error
		return { ...data, name: data.id }
	}
	if (doc.doctype === 'Course Lesson') {
		const outline = await getOutline(doc.course)
		const chapter = outline.find((row) => row.name === doc.chapter)
		const payload = { course_id: doc.course, chapter_id: doc.chapter, title: doc.title, content: doc.content ? JSON.parse(doc.content) : { blocks: [] }, sort_order: chapter?.lessons?.length || 0, is_preview: Boolean(doc.include_in_preview), published: true }
		const { data, error } = await supabase.from('lessons').insert(payload).select().single()
		if (error) throw error
		return { ...data, name: data.id }
	}
	if (doc.doctype === 'Lesson Reference') return { name: doc.lesson }
	throw new Error(`Unsupported insert doctype: ${doc.doctype}`)
}

async function saveProgress(params) {
	const { data: auth } = await supabase.auth.getUser()
	const { data, error } = await supabase.from('lesson_progress').upsert({ lesson_id: params.lesson, course_id: params.course, user_id: auth.user.id, completed: true, completed_at: new Date().toISOString() }, { onConflict: 'lesson_id,user_id' }).select().single()
	if (error) throw error
	return courseMembership(params.course).then((membership) => membership?.progress || 0)
}

export async function compatibilityCall(method, params = {}) {
	switch (method) {
		case 'lms.lms.api.get_user_info': return toFrappeUser(await currentProfile())
		case 'lms.lms.api.get_all_users': return []
		case 'lms.lms.api.get_branding': return { app_name: 'KIS Learning', app_logo: '/legacy-public/assets/kis-logo-horizontal.png', favicon: { file_url: '/favicon.ico' } }
		case 'lms.lms.api.get_lms_settings': return { allow_guest_access: false, disable_pwa: true, show_dashboard: true, show_jobs: false, show_certified_participants: false, show_course_review: false }
		case 'lms.lms.api.get_sidebar_settings': return { courses: 1, batches: 0, programs: 0, jobs: 0, certified_participants: 0, web_pages: [] }
		case 'lms.lms.utils.get_courses': return listCourses(params)
		case 'lms.lms.utils.get_course_categories': {
			const { data, error } = await supabase.from('courses').select('category').not('category', 'is', null)
			if (error) throw error
			return [...new Set((data || []).map((row) => row.category))].map((name) => ({ name }))
		}
		case 'lms.lms.utils.get_course_details': return getCourse(params.course)
		case 'lms.lms.utils.get_course_outline': return getOutline(params.course, Boolean(params.progress))
		case 'lms.lms.utils.get_lesson': return getLesson(params)
		case 'lms.lms.utils.get_lesson_creation_details': return getLessonCreationDetails(params)
		case 'lms.lms.api.create_lesson': return createLesson(params.chapter)
		case 'lms.lms.doctype.course_lesson.course_lesson.save_progress': return saveProgress(params)
		case 'lms.lms.api.get_profile_details': return { ...toFrappeUser(await currentProfile()), headline: '', bio: '', location: '', interests: [], roles: [] }
		case 'lms.lms.api.get_badges': return []
		case 'lms.lms.api.get_meta_info': return []
		case 'lms.lms.api.update_meta_info': return true
		case 'lms.lms.utils.get_related_courses': return []
		case 'lms.lms.api.get_my_courses': return { courses: await listCourses({ limit: 100 }) }
		case 'lms.lms.api.get_my_batches': return []
		case 'lms.lms.api.get_created_courses': return listCourses({ limit: 100 })
		case 'lms.lms.api.get_created_batches': return []
		case 'lms.lms.utils.get_programs': return { enrolled: [], published: [] }
		case 'lms.lms.api.search_users_by_role': {
			const profile = await currentProfile()
			return [{ name: profile.id, value: profile.id, label: profile.full_name || profile.email, description: profile.email, user_image: profile.avatar_url || '' }]
		}
		case 'frappe.onboarding.get_onboarding_status': return {}
		case 'frappe.client.get': return params.doctype === 'LMS Course' ? getCourse(params.name) : null
		case 'frappe.client.get_list': return []
		case 'frappe.client.get_value': return params.doctype === 'Course Lesson' ? getLessonByName(params.filters?.name || params.name) : null
		case 'frappe.desk.search.search_link': return []
		case 'frappe.geo.country_info.get_country_timezone_info': return { all_timezones: ['Asia/Ho_Chi_Minh'] }
		case 'frappe.client.set_value': return setValue(params)
		case 'frappe.client.insert': return insertDoc(params.doc)
		case 'lms.lms.api.upsert_chapter': return upsertChapter(params)
		case 'lms.lms.api.delete_course': return deleteCourse(params.course)
		case 'logout': return supabase.auth.signOut().then(() => null)
		case 'frappe.sessions.clear': return null
		default: return null
	}
}

async function getLessonByName(name) {
	const { data, error } = await supabase.from('lessons').select('*').eq('id', name).single()
	if (error) throw error
	const content = data.content?.blocks ? data.content : { blocks: [] }
	return { ...data, name: data.id, include_in_preview: data.is_preview ? 1 : 0, content: JSON.stringify(content) }
}

async function upsertChapter(params) {
	const payload = { course_id: params.course, title: params.title }
	let query
	if (params.name) query = supabase.from('chapters').update(payload).eq('id', params.name)
	else {
		const { count } = await supabase.from('chapters').select('*', { count: 'exact', head: true }).eq('course_id', params.course)
		query = supabase.from('chapters').insert({ ...payload, sort_order: count || 0 })
	}
	const { data, error } = await query.select().single()
	if (error) throw error
	return { ...data, name: data.id }
}

async function deleteCourse(course) {
	const { error } = await supabase.from('courses').delete().eq('id', course)
	if (error) throw error
	return null
}

async function createLesson(chapterId) {
	const { data: chapter, error: chapterError } = await supabase.from('chapters').select('id,course_id').eq('id', chapterId).single()
	if (chapterError) throw chapterError
	const { count } = await supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('chapter_id', chapterId)
	const { data, error } = await supabase.from('lessons').insert({ chapter_id: chapterId, course_id: chapter.course_id, title: 'Untitled lesson', content: { blocks: [] }, sort_order: count || 0, is_preview: false, published: true }).select().single()
	if (error) throw error
	return data.id
}

async function getLessonCreationDetails(params) {
	const outline = await getOutline(params.course)
	const chapter = outline[Number(params.chapter) - 1]
	const lesson = chapter?.lessons?.[Number(params.lesson) - 1]
	if (!lesson) return {}
	return { chapter, lesson: await getLessonByName(lesson.name) }
}

export function resourceFetcher({ url, params }) {
	return compatibilityCall(url, params || {})
}
