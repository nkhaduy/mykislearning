// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { attachLegacyStyles } from './style-links'

describe('attachLegacyStyles', () => {
  it('adds page styles and removes them during cleanup', () => {
    const cleanup = attachLegacyStyles(['/font.css', '/home.css'])

    expect(document.head.querySelectorAll('[data-legacy-public-style]')).toHaveLength(2)

    cleanup()
    expect(document.head.querySelectorAll('[data-legacy-public-style]')).toHaveLength(0)
  })
})
