/**
 * A recorded combination, one pill per key (KAN-975 §2).
 *
 * Pills rather than a single "Ctrl+1" string because the mockup shows keycaps,
 * and because the separator is the easiest thing to misread at this size — a
 * plus sign between two pale glyphs looks like part of the key.
 */
import { hotkeyParts } from '../shortcutRecorder'

export function ShortcutBadge({ hotkey }: { hotkey: string }) {
  return (
    <span className="flex items-center gap-1">
      {hotkeyParts(hotkey).map((part, index) => (
        <kbd
          key={`${part}-${index}`}
          className="border-border bg-muted text-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 font-sans text-xs font-medium"
        >
          {part}
        </kbd>
      ))}
    </span>
  )
}
