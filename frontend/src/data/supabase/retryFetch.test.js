import { describe, expect, it, vi } from 'vitest'
import { createRetryFetch } from './retryFetch'

describe('createRetryFetch', () => {
  it('retries transient network failures', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(new Response('{}', { status: 200 }))

    const response = await createRetryFetch(fetchImpl, { delayMs: 0 })('https://example.com')

    expect(response.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry HTTP error responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }))

    const response = await createRetryFetch(fetchImpl, { delayMs: 0 })('https://example.com')

    expect(response.status).toBe(403)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
