export function toFrappeCourse(course, extras = {}) {
	return {
		name: course.id,
		title: course.title || course.id,
		short_introduction: course.short_description || '',
		description: course.description || '',
		image: course.image_url || null,
		category: course.category || null,
		published: course.published ? 1 : 0,
		upcoming: 0,
		featured: 0,
		paid_course: 0,
		paid_certificate: 0,
		enable_certification: 0,
		disable_self_learning: course.self_enroll_enabled === false ? 1 : 0,
		card_gradient: 'blue',
		instructors: extras.instructors || [],
		membership: extras.membership || null,
		lessons: extras.lessons || 0,
		enrollments: extras.enrollments || 0,
		rating: 0,
		rating_count: 0,
		...extras,
	}
}

export function toFrappeOutline(chapters, completedLessonIds = new Set()) {
	return [...(chapters || [])]
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((chapter, chapterIndex) => ({
			name: chapter.id,
			title: chapter.title,
			number: chapterIndex + 1,
			lessons: [...(chapter.lessons || [])]
				.sort((a, b) => a.sort_order - b.sort_order)
				.map((lesson, lessonIndex) => ({
					name: lesson.id,
					title: lesson.title,
					number: `${chapterIndex + 1}-${lessonIndex + 1}`,
					include_in_preview: lesson.is_preview ? 1 : 0,
					completed: completedLessonIds.has(lesson.id),
				})),
		}))
}

export function toFrappeUser(profile) {
	const isHr = String(profile.role).toLowerCase() === 'hr'
	return {
		name: profile.id,
		username: profile.email || profile.id,
		email: profile.email,
		full_name: profile.full_name || profile.email || profile.id,
		user_image: profile.avatar_url || null,
		roles: isHr ? ['Moderator', 'Course Creator'] : ['LMS Student'],
		is_moderator: isHr,
		is_instructor: isHr,
		is_student: !isHr,
		is_system_manager: false,
		developer_mode: false,
		is_fc_site: false,
	}
}

export function toFrappeLessonContent(content) {
	if (content?.html) return { content: null, body: content.html }
	if (content?.blocks) return { content: JSON.stringify(content), body: '' }
	if (typeof content === 'string') return { content: null, body: content }
	return { content: null, body: '' }
}
