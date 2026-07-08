/**
 * useConfirm
 *
 * Promise-based replacement for the native `window.confirm`. Returns a
 * `confirm()` that resolves to `true`/`false`, plus a `confirmDialog` element
 * to render once in your component tree.
 *
 *   const { confirm, confirmDialog } = useConfirm()
 *   ...
 *   if (!(await confirm({ title: '…', message: '…', tone: 'danger' }))) return
 *   ...
 *   return (<>{confirmDialog}{rest}</>)
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog, type ConfirmTone } from './ConfirmDialog'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
  /** Optional custom icon; falls back to the tone-derived default. */
  icon?: ReactNode
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

const CLOSED: ConfirmState = { open: false, title: '' }

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(CLOSED)
  const resolverRef = useRef<((result: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState({ ...options, open: true })
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    setState((prev) => ({ ...prev, open: false }))
    resolverRef.current?.(result)
    resolverRef.current = null
  }, [])

  const confirmDialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      tone={state.tone}
      icon={state.icon}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )

  return { confirm, confirmDialog }
}

export default useConfirm
