/**
 * The "click, then press the keys you want" box (KAN-975 §3).
 *
 * Thin: every rule about what a keypress means lives in `shortcutRecorder`,
 * which is unit-tested. This owns the focus behaviour and the three labels.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { describeHotkey, readRecorderKey } from '../shortcutRecorder'

export function ShortcutRecorderBox({
  value,
  disabled,
  onRecorded,
  onCancel,
}: {
  /** The combination currently held for the selected template, canonical form. */
  value: string | null
  /** True until a template is chosen — there is nothing to record onto yet. */
  disabled?: boolean
  onRecorded: (hotkey: string) => void
  /** Escape: the caller restores whatever the template had. */
  onCancel: () => void
}) {
  // Note for callers: remount this with a `key` tied to the selected template.
  // Recording is local state, and left armed across a template change it would
  // record onto whichever template is selected when the next key lands.
  const { t } = useTranslation()
  const [recording, setRecording] = useState(false)
  const [partial, setPartial] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const stop = () => {
    setRecording(false)
    setPartial(null)
  }

  const label = recording
    ? (partial ?? t('pages.profile.shortcuts.pressKeys', 'Press keys…'))
    : value
      ? describeHotkey(value)
      : t('pages.profile.shortcuts.clickToRecord', 'Click to record')

  return (
    <div
      ref={boxRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={t('pages.profile.shortcuts.recorderLabel', 'Shortcut recorder')}
      onClick={() => {
        if (disabled) return
        setRecording(true)
        setPartial(null)
        boxRef.current?.focus()
      }}
      onBlur={stop}
      onKeyDown={(event) => {
        // Before recording starts the box is an ordinary button: Enter and
        // Space arm it, and every other key belongs to the page.
        if (!recording) {
          if (disabled) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setRecording(true)
            setPartial(null)
          }
          return
        }

        // Recording: the box owns every key, including Tab and Enter, or the
        // operator could never record them.
        event.preventDefault()
        const outcome = readRecorderKey(event)
        if (outcome.type === 'cancel') {
          stop()
          onCancel()
          return
        }
        if (outcome.type === 'partial') {
          setPartial(outcome.label)
          return
        }
        if (outcome.type === 'commit') {
          stop()
          onRecorded(outcome.hotkey)
        }
      }}
      className={cn(
        'border-input-border bg-input flex h-11 w-full items-center rounded-lg border px-4 text-sm transition-colors',
        'focus:ring-primary-500 focus:border-primary-500 focus:ring-2 focus:outline-none',
        disabled && 'cursor-not-allowed opacity-50',
        !disabled && 'cursor-pointer',
        recording && 'border-primary-500 text-primary-700',
        !recording && value && 'text-foreground font-medium',
        !recording && !value && 'text-muted-foreground'
      )}
    >
      {label}
    </div>
  )
}
