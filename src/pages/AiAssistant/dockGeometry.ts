/**
 * Desktop geometry of the fixed input dock on /dashboard/ai-assistant.
 *
 * The dock is `fixed`, so it does not inherit the chat column box from the
 * normal flow. To keep the dock (and the quick-action buttons inside it)
 * centred on the SAME column as the message ribbon, its fixed box must be
 * geometrically identical to the chat content box:
 *
 *   left  = dashboard rail (72px collapsed / 240px expanded)
 *         + 28px `<main>` left padding
 *         + history reserve (history panel 280px expanded / 56px collapsed,
 *           plus the 1rem gap the page root adds after the panel)
 *   right = 28px `<main>` right padding
 *
 * `lg:w-auto` is essential: the mobile box is `left-0 right-0 w-full`, and an
 * explicit width together with `left` over-constrains the box — `right` gets
 * ignored and the dock becomes a viewport-wide strip starting at `left`, so
 * its `mx-auto` column drifts right of the chat (the pre-fix bug). With
 * `width: auto` the box is defined by left+right, and since the inner
 * horizontal paddings and `mx-auto max-w-*` caps match the message ribbon,
 * an identical box means an identical column centre in every combination.
 */

const DOCK_DESKTOP_BOX_BASE = 'lg:right-7 lg:w-auto'

/* 72 + 28 + (56 + 16) = 172px */
const LEFT_RAIL_COLLAPSED_HISTORY_COLLAPSED = 'lg:left-[10.75rem]'
/* 72 + 28 + (280 + 16) = 396px */
const LEFT_RAIL_COLLAPSED_HISTORY_EXPANDED = 'lg:left-[24.75rem]'
/* 240 + 28 + (56 + 16) = 340px */
const LEFT_RAIL_EXPANDED_HISTORY_COLLAPSED = 'lg:left-[21.25rem]'
/* 240 + 28 + (280 + 16) = 564px */
const LEFT_RAIL_EXPANDED_HISTORY_EXPANDED = 'lg:left-[35.25rem]'

/**
 * @param isEmbedded OneX dock mode (`?embed=dock`): the dashboard rail and the
 *   history panel are not rendered, so there is nothing to clear — the dock
 *   keeps its full-width box (`left-0 right-0 w-full`) at every viewport width.
 *   Returning desktop offsets here would push the composer off a host window
 *   wider than the `lg` breakpoint.
 */
export function getDockDesktopBoxClasses(
  isOpenSideBar: boolean,
  isHistoryCollapsed: boolean,
  isEmbedded = false
): string {
  if (isEmbedded) return ''

  const left = isOpenSideBar
    ? isHistoryCollapsed
      ? LEFT_RAIL_EXPANDED_HISTORY_COLLAPSED
      : LEFT_RAIL_EXPANDED_HISTORY_EXPANDED
    : isHistoryCollapsed
      ? LEFT_RAIL_COLLAPSED_HISTORY_COLLAPSED
      : LEFT_RAIL_COLLAPSED_HISTORY_EXPANDED
  return `${left} ${DOCK_DESKTOP_BOX_BASE}`
}

/**
 * `<main>` right padding — the dock's resting right gap (`lg:right-7` = 28px),
 * kept identical when the reasoning «Активность» panel pushes the dock left.
 */
export const DOCK_MAIN_PADDING_PX = 28

/**
 * Inline `right` (px) for the fixed dock when the reasoning activity panel is
 * open on desktop. The panel occupies the rightmost `panelWidthPx`, so the
 * dock's right edge must move left by that width and keep the same 28px gap it
 * has at rest — geometrically mirroring the `paddingRight` the page root adds to
 * the message ribbon, so dock and ribbon stay on one column.
 *
 * Returns `undefined` when the panel is closed (the `lg:right-7` class then owns
 * the right edge) or on narrow screens (the panel overlays the content instead
 * of reserving space). An inline style wins over the Tailwind class, so an
 * `undefined` result cleanly restores the resting geometry.
 */
export function getDockRightOffset(
  panelOpen: boolean,
  isMobileOrTablet: boolean,
  panelWidthPx: number
): number | undefined {
  if (!panelOpen || isMobileOrTablet) return undefined
  return panelWidthPx + DOCK_MAIN_PADDING_PX
}
