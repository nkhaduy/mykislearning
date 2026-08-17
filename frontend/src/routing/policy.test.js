import { describe, expect, it } from 'vitest'
import { isPublicRoute, safeProtectedDestination } from './policy'

describe('safeProtectedDestination', () => {
  it.each([
    '/courses',
    '/courses/course-1',
    '/courses/course-1/lessons/lesson-1',
    '/admin',
  ])('accepts known protected path %s', (path) => {
    expect(safeProtectedDestination(path)).toBe(path)
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    '/',
    '/login',
    '/about-kis',
    '/unknown',
  ])('falls back for unsafe destination %s', (path) => {
    expect(safeProtectedDestination(path)).toBe('/courses')
  })
})

describe('isPublicRoute', () => {
  it.each(['/', '/about', '/about-kis', '/login'])('classifies %s as public', (path) => {
    expect(isPublicRoute(path)).toBe(true)
  })

  it.each(['/courses', '/courses/course-1', '/admin'])('classifies %s as protected', (path) => {
    expect(isPublicRoute(path)).toBe(false)
  })
})
