interface WindowState {
  allowed: boolean
  message: string | null
}

/**
 * Why the calling window should stop the call dialog from opening, or null.
 *
 * Opening a dialog whose dial button cannot be pressed reads as a broken
 * dialog rather than a closed window, so the entry points are gated too — but
 * the same dialog is the only route to marking a number as spam, which is not
 * placing a call and has nothing to do with the window. Where spam marking is
 * on offer the dialog opens regardless; its dial button stays disabled and
 * says why.
 */
export function callDialogBlockedReason(
  window: WindowState,
  spamOptionEnabled: boolean
): string | null {
  if (window.allowed || !window.message || spamOptionEnabled) return null
  return window.message
}
