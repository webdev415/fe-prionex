/**
 * Mitigate React crashes when browser translation (Chrome, Edge, extensions)
 * mutates the DOM outside React's control.
 *
 * See: https://github.com/facebook/react/issues/11538
 *      https://github.com/radix-ui/primitives/issues/2578
 *
 * The app already uses i18next for localization — disable built-in page
 * translation via index.html (`translate="no"`) and patch DOM APIs as a
 * safety net for operators who still have auto-translate enabled.
 */

declare global {
  interface Window {
    __prionexDomTranslationCompatApplied?: boolean
  }
}

export function applyDomTranslationCompat(): void {
  if (typeof window === 'undefined' || window.__prionexDomTranslationCompatApplied) {
    return
  }

  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode === this) {
      return originalRemoveChild.call(this, child) as T
    }
    return child
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return originalInsertBefore.call(this, newNode, null) as T
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T
  }

  window.__prionexDomTranslationCompatApplied = true
}

export function isDomTranslationConflictError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const normalized = message.toLowerCase()
  return (
    normalized.includes("failed to execute 'removechild'") ||
    normalized.includes("failed to execute 'insertbefore'") ||
    normalized.includes('not a child of this node')
  )
}
