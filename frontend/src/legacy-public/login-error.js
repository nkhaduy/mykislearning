export function loginErrorCode(error) {
  if (error?.status === 429) return 'rate'
  if (/invalid login credentials/i.test(error?.message || '')) return 'invalid'
  return 'system'
}
