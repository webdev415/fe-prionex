/**
 * Sizing constants for the reasoning «Активность» side panel.
 *
 * Kept in a component-free module so both the panel component and the store can
 * import them without tripping react-refresh (fast refresh wants component files
 * to export only components).
 */

/** Resizable width bounds of the activity panel (desktop only), in px. */
export const MIN_REASONING_PANEL_WIDTH = 340
export const MAX_REASONING_PANEL_WIDTH = 760
export const DEFAULT_REASONING_PANEL_WIDTH = 420

/** Keyboard resize step (px) for the panel's separator handle. */
export const REASONING_PANEL_RESIZE_STEP = 16

/** Clamp any candidate width into the resizable range (integer px). */
export function clampReasoningPanelWidth(width: number): number {
  return Math.max(MIN_REASONING_PANEL_WIDTH, Math.min(MAX_REASONING_PANEL_WIDTH, Math.round(width)))
}
