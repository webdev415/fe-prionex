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

export function getDockDesktopBoxClasses(
  isOpenSideBar: boolean,
  isHistoryCollapsed: boolean
): string {
  const left = isOpenSideBar
    ? isHistoryCollapsed
      ? LEFT_RAIL_EXPANDED_HISTORY_COLLAPSED
      : LEFT_RAIL_EXPANDED_HISTORY_EXPANDED
    : isHistoryCollapsed
      ? LEFT_RAIL_COLLAPSED_HISTORY_COLLAPSED
      : LEFT_RAIL_COLLAPSED_HISTORY_EXPANDED
  return `${left} ${DOCK_DESKTOP_BOX_BASE}`
}
