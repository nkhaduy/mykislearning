const publicPaths = new Set(['/', '/about', '/about-kis', '/login'])
const protectedPatterns = [
  /^\/courses$/,
  /^\/courses\/[^/]+$/,
  /^\/courses\/[^/]+\/lessons\/[^/]+$/,
  /^\/admin$/,
]

export function isPublicRoute(path) {
  return publicPaths.has(path)
}

export function safeProtectedDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/courses'
  const path = value.split(/[?#]/, 1)[0]
  return protectedPatterns.some((pattern) => pattern.test(path)) ? value : '/courses'
}
