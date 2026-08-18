import { describe, expect, it } from 'vitest'
import { syncFrappeSessionCookie } from '@/backend/auth'

describe('Frappe session compatibility cookie', () => {
	it('mirrors the Supabase email for upstream sessionUser helpers', () => {
		syncFrappeSessionCookie('employee@kislms.site')
		expect(document.cookie).toContain('user_id=employee%40kislms.site')
	})

	it('marks a signed-out browser as Guest', () => {
		syncFrappeSessionCookie(null)
		expect(document.cookie).toContain('user_id=Guest')
	})
})
