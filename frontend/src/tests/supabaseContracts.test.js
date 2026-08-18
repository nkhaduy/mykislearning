import { describe, expect, it } from 'vitest'
import { toFrappeCourse, toFrappeLessonContent, toFrappeOutline, toFrappeUser } from '@/backend/contracts'

describe('Frappe LMS compatibility contracts', () => {
	it('maps Supabase course columns without changing CourseCard', () => {
		expect(toFrappeCourse({ id: 'c-1', title: 'Safety', short_description: 'Intro', image_url: '/cover.png', published: true })).toMatchObject({
			name: 'c-1', title: 'Safety', short_introduction: 'Intro', image: '/cover.png', published: 1,
			instructors: [], membership: null, card_gradient: 'blue',
		})
	})

	it('maps ordered chapters and lessons to upstream numbering', () => {
		expect(toFrappeOutline([{ id: 'ch-1', title: 'Start', sort_order: 0, lessons: [{ id: 'l-1', title: 'Welcome', sort_order: 0, is_preview: true }] }])).toEqual([
			{ name: 'ch-1', title: 'Start', number: 1, lessons: [{ name: 'l-1', title: 'Welcome', number: '1-1', include_in_preview: 1, completed: false }] },
		])
	})

	it('maps HR to upstream moderator and instructor capabilities', () => {
		expect(toFrappeUser({ id: 'p-1', email: 'hr@kisvn.vn', full_name: 'HR User', role: 'HR' })).toMatchObject({
			name: 'p-1', username: 'hr@kisvn.vn', is_moderator: true, is_instructor: true,
		})
	})

	it('routes legacy HTML lesson content through the upstream LessonContent renderer', () => {
		expect(toFrappeLessonContent({ html: '<p>Welcome</p>' })).toEqual({ content: null, body: '<p>Welcome</p>' })
	})
})
