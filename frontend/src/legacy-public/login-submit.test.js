import { describe, expect, it, vi } from 'vitest'
import { submitLogin } from './login-submit'

describe('submitLogin', () => {
  it('authenticates through the session store and redirects', async () => {
    const session = { signIn: vi.fn().mockResolvedValue(undefined) }
    const router = { replace: vi.fn().mockResolvedValue(undefined) }

    await submitLogin({
      session,
      router,
      destination: '/courses/course-1',
      email: 'employee@example.com',
      password: 'not-a-real-secret',
    })

    expect(session.signIn).toHaveBeenCalledWith('employee@example.com', 'not-a-real-secret')
    expect(router.replace).toHaveBeenCalledWith('/courses/course-1')
  })
})
