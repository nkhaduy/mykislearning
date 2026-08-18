export function syncFrappeSessionCookie(email) {
	document.cookie = `user_id=${encodeURIComponent(email || 'Guest')}; path=/; SameSite=Lax`
}
