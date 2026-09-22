/* eslint-disable react-refresh/only-export-components -- `piiProps` and
   `piiHiddenProps` are object constants, which `allowConstantExport` does not
   cover, and they belong next to `<Pii>`: the attribute name must be spelled in
   exactly one place, and a second module for two frozen objects would be one
   more import to get wrong. Same treatment as components/ui/Card.tsx et al. */
/**
 * OpenReplay PII markup — the one place the obscuring attribute is spelled out.
 *
 * The tracker masks digits (`obscureTextNumbers`) and input values
 * (`defaultInputMode: 2`), but NOTHING masks letters: client names, addresses and
 * free-text operator comments reach a recording verbatim. The fix is
 * `data-openreplay-obscured` on the blocks that hold that data (KAN-KB-54).
 *
 * 🔴 Why a constant instead of the literal at each of a hundred call sites: a
 * typo in the attribute name is a SILENT leak. `data-openreplay-obscure` renders
 * without complaint — typecheck, lint and tests all stay green, and the block is
 * simply recorded in the clear. There is no runtime that would notice.
 *
 * Mechanics, verified by reading `@openreplay/tracker@18.0.6`
 * (`dist/lib/index.js`), not the documentation:
 *
 * - `Sanitizer.handleNode` adds a node to the obscured set when its PARENT is in
 *   that set, so the attribute INHERITS down the subtree. One attribute on a
 *   card closes every field inside it — that is the intended way to use this.
 * - There is no way to undo the inheritance. `data-openreplay-unmask` is read
 *   only inside the `privateMode` branch, which is off here, so "mask the root
 *   and reopen the parts" is not available. Markup goes bottom-up, from blocks.
 * - Obscured text is wiped per character (`stringWiper`), so the layout and the
 *   string length survive and the screen stays recognisable.
 * - `<img>` inside an obscured subtree is replaced by a placeholder, and input
 *   values are forced to `InputMode.Obscured`.
 * - ⚠️ ATTRIBUTES ARE NOT MASKED AT ALL outside `privateMode` — `title`,
 *   `aria-label`, `alt` and `placeholder` are sent as they are, from obscured and
 *   hidden nodes alike. PII in an attribute must be REMOVED, not marked up.
 * - ⚠️ Inheritance does not cross a portal (the portal's DOM parent is
 *   `document.body`) and does not reach iframe capture, which reads the attribute
 *   on the `<iframe>` node itself.
 */

import type { ReactNode } from 'react'

/** `data-openreplay-obscured` — text becomes asterisks, images become placeholders. */
export const OPENREPLAY_OBSCURED_ATTR = 'data-openreplay-obscured'

/**
 * `data-openreplay-hidden` — the node is cloned WITHOUT its children, keeping
 * its measured width and height so the grid does not collapse.
 *
 * For document previews and scans only. For text use `obscured`: hidden drops
 * the structure as well, which makes a recording unreadable rather than masked.
 */
export const OPENREPLAY_HIDDEN_ATTR = 'data-openreplay-hidden'

/**
 * Click-label attribute. The tracker builds a click's label from
 * `data-openreplay-label` → the input's label → a custom attribute → `#id` → a
 * SELECTOR BUILT FROM CLASS NAMES → the element's text. With Tailwind the
 * selector branch wins almost always, but a clickable element whose visible text
 * is PII and which has neither classes nor an id would label its clicks with
 * asterisks. Give those elements a role label instead.
 */
export const OPENREPLAY_LABEL_ATTR = 'data-openreplay-label'

/**
 * Spread onto an element that already exists in the markup.
 *
 * The empty string renders as `data-openreplay-obscured=""`, which is what the
 * tracker's `hasAttribute` check looks for — the attribute's presence is the
 * signal, its value is never read.
 *
 * 🔴 Spread this onto an INTRINSIC element (`<div>`, `<td>`, `<span>`) or onto a
 * component whose source you have read and which forwards `...rest` to a DOM
 * node. A component that drops unknown props swallows the attribute in silence:
 * nothing in the toolchain reports it, and the block is recorded in the clear.
 * When in doubt wrap with `<Pii>` instead, and cover the place with
 * `expectObscured` in the same PR.
 */
export const piiProps = { [OPENREPLAY_OBSCURED_ATTR]: '' } as const

/** Same, for the `hidden` level. See {@link OPENREPLAY_HIDDEN_ATTR}. */
export const piiHiddenProps = { [OPENREPLAY_HIDDEN_ATTR]: '' } as const

/**
 * The elements `<Pii>` can render as.
 *
 * A closed union rather than a polymorphic generic on purpose: typing `as`
 * generically costs more than it saves here, and the list exists so the wrapper
 * cannot produce invalid markup — `<span>` is the default because it is valid
 * inside a `<p>`, a `<td>` and a heading alike.
 *
 * ⚠️ None of these is a valid direct child of `<tr>`, `<tbody>`, `<ul>` or
 * `<select>`. In a table use `Column.obscured` (the attribute lands on the
 * `<td>`); in a list mark the `<li>`.
 */
export type PiiAs = 'span' | 'div' | 'td' | 'p' | 'li'

export interface PiiProps {
  /** Which element to render. Default `span`. */
  as?: PiiAs
  children?: ReactNode
  className?: string
  title?: string
  style?: React.CSSProperties
}

/**
 * Wrapper for places that have no container of their own to mark up.
 *
 * Prefer marking an element that already exists — a card, a row cell, a section
 * — over adding a node. This is for the leftovers: an interpolated name inside a
 * heading that must otherwise stay readable, a toast body, a tooltip's content.
 */
export function Pii({ as = 'span', children, ...rest }: PiiProps) {
  const Tag = as
  return (
    <Tag {...rest} {...piiProps}>
      {children}
    </Tag>
  )
}

export default Pii
