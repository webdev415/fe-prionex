/**
 * Call dialog modal timing — tuned so logging finishes before close without excess delay.
 *
 * Auto-close starts only after the call record reaches a terminal backend state
 * (or after MAX_WAIT if the API is slow). The countdown gives operators a brief
 * moment to read the ended summary.
 */
export const CALL_MODAL_AUTO_CLOSE_SECONDS = 1

/** Fallback when terminal state is not observed (e.g. network loss). */
export const CALL_MODAL_AUTO_CLOSE_MAX_WAIT_MS = 5000
