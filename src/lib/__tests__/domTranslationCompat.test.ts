import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { applyDomTranslationCompat, isDomTranslationConflictError } from '../domTranslationCompat'

describe('domTranslationCompat', () => {
  beforeEach(() => {
    delete (window as Window & { __prionexDomTranslationCompatApplied?: boolean })
      .__prionexDomTranslationCompatApplied
    applyDomTranslationCompat()
  })

  afterEach(() => {
    delete (window as Window & { __prionexDomTranslationCompatApplied?: boolean })
      .__prionexDomTranslationCompatApplied
  })

  it('removeChild returns the node when parent does not match', () => {
    const parent = document.createElement('div')
    const child = document.createElement('span')
    const otherParent = document.createElement('div')
    otherParent.appendChild(child)

    expect(() => parent.removeChild(child)).not.toThrow()
    expect(child.parentNode).toBe(otherParent)
  })

  it('insertBefore appends when reference node is detached', () => {
    const parent = document.createElement('div')
    const newNode = document.createElement('span')
    const detachedRef = document.createElement('i')

    parent.insertBefore(newNode, detachedRef)
    expect(parent.contains(newNode)).toBe(true)
  })

  it('detects translation-related DOM errors', () => {
    expect(
      isDomTranslationConflictError(
        new Error(
          "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
        )
      )
    ).toBe(true)
    expect(isDomTranslationConflictError(new Error('Network Error'))).toBe(false)
  })
})
