import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { LoginResponse } from '@/types/api'
import { loginApprovalApi } from '../api/loginApprovalApi'
import type { ApprovalRefusal } from '../lib/approval'
import {
  runApprovalSession,
  type ApprovalSession,
  type LoginApprovalPhase,
  type LoginApprovalStartBody,
} from '../lib/approvalSession'
import type { AppApprovalClient } from '../types'
import { appLoginKeys } from './useAppLogin'

/**
 * Which «confirm on the phone» buttons this stand offers. A 404 (feature off)
 * or any error leaves `data` undefined and the buttons hidden — no retry, no
 * build flag: the server alone decides.
 */
export function useAppApprovalConfig() {
  return useQuery({
    queryKey: appLoginKeys.config(),
    queryFn: loginApprovalApi.config,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

interface UseLoginApprovalOptions {
  client?: AppApprovalClient
  onApproved: (login: LoginResponse) => Promise<void> | void
  onRefused: (refusal: ApprovalRefusal) => void
  /**
   * The phone cannot be asked (mode off, no phone). The card shows `failed`;
   * the 2FA step uses this to switch to the Google Authenticator code instead.
   * `reset` is `cancel` handed in, so a caller that leaves the flow does not
   * reach for the hook's own return value from inside its options.
   */
  onUnavailable?: (reset: () => void) => void
}

const IDLE: LoginApprovalPhase = { kind: 'idle' }

/**
 * One confirmation request at a time for the login screen. Every start comes
 * from a click (never from an effect), so React's double-mounted effects in
 * development cannot fire a second request that would spend the person's
 * limit. Unmounting stops the poll and cancels a request still pending.
 */
export function useLoginApproval(options: UseLoginApprovalOptions) {
  const [phase, setPhase] = useState<LoginApprovalPhase>(IDLE)
  const sessionRef = useRef<ApprovalSession | null>(null)
  const lastBodyRef = useRef<LoginApprovalStartBody | null>(null)
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  })

  const stopSession = useCallback(() => {
    sessionRef.current?.stop()
    sessionRef.current = null
  }, [])

  /** «Скасувати» / leaving the flow: stop, cancel on the server, back to idle. */
  const cancel = useCallback(() => {
    stopSession()
    lastBodyRef.current = null
    setPhase(IDLE)
  }, [stopSession])

  const start = useCallback(
    (body: LoginApprovalStartBody) => {
      stopSession()
      lastBodyRef.current = body
      sessionRef.current = runApprovalSession(body, {
        client: optionsRef.current.client ?? 'crm_web',
        onPhase: setPhase,
        onApproved: (login) => optionsRef.current.onApproved(login),
        onRefused: (refusal) => {
          setPhase(IDLE)
          optionsRef.current.onRefused(refusal)
        },
        onUnavailable: () => {
          setPhase({ kind: 'failed' })
          optionsRef.current.onUnavailable?.(cancel)
        },
      })
    },
    [stopSession, cancel]
  )

  /** «Надіслати ще раз»: the same body again; the server supersedes the old request. */
  const resend = useCallback(() => {
    if (lastBodyRef.current) start(lastBodyRef.current)
  }, [start])

  useEffect(() => stopSession, [stopSession])

  return { phase, start, resend, cancel }
}
