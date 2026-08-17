import { describe, expect, it } from 'vitest'
import { loginErrorCode } from './login-error'

describe('loginErrorCode', () => {
  it('maps invalid credentials without exposing backend text', () => {
    expect(loginErrorCode({ message: 'Invalid login credentials' })).toBe('invalid')
  })

  it('maps rate limits', () => {
    expect(loginErrorCode({ status: 429 })).toBe('rate')
  })

  it('uses a generic system error otherwise', () => {
    expect(loginErrorCode(new Error('internal detail'))).toBe('system')
  })
})
