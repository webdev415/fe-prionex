import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersKeys } from '@/features/users/hooks/useUsers'
import { appLoginApi } from '../api/appLoginApi'
import { retryStatusRead } from '../lib/pairing'
import type { AppLoginDisableRequest, AppLoginEnableRequest } from '../types'

export const appLoginKeys = {
  all: ['auth', 'app-login'] as const,
  me: () => [...appLoginKeys.all, 'me'] as const,
  admin: (userId: number) => [...appLoginKeys.all, 'admin', userId] as const,
  /** `GET /api/v1/auth/app-login/config` — the login screen's buttons. */
  config: () => [...appLoginKeys.all, 'config'] as const,
}

interface MyStatusOptions {
  enabled?: boolean
  /** Poll interval while the profile waits for the phone to enroll. */
  pollMs?: number | false
  /**
   * `Date.now()` after which the poll stops by itself. The pairing code dies
   * on the server by its TTL; polling past it only keeps resetting the idle
   * timer (every successful response does) and loads auth-service for nothing
   * when the person leaves the expired panel open.
   */
  pollUntil?: number
}

/**
 * The caller's own phone-binding status. A 404 (feature flag off) is not
 * retried: it is an answer, not a failure. A network error or a 5xx is retried
 * a couple of times before the section shows its error line (`retryStatusRead`).
 */
export function useMyAppLoginStatus({
  enabled = true,
  pollMs = false,
  pollUntil,
}: MyStatusOptions = {}) {
  return useQuery({
    queryKey: appLoginKeys.me(),
    queryFn: appLoginApi.myStatus,
    enabled,
    retry: retryStatusRead,
    staleTime: 30_000,
    // A function, so it is re-read before every tick and stops at `pollUntil`
    // without the component having to re-render at that moment.
    refetchInterval: () =>
      pollMs && (pollUntil === undefined || Date.now() < pollUntil) ? pollMs : false,
    refetchIntervalInBackground: false,
  })
}

/**
 * Re-read the caller's status now. The profile calls it when the pairing panel
 * is closed: the poll stops with the panel, and a phone that enrolled in the
 * last seconds must still show up in the list.
 */
export function useInvalidateMyAppLoginStatus() {
  const qc = useQueryClient()
  return useCallback(() => qc.invalidateQueries({ queryKey: appLoginKeys.me() }), [qc])
}

export function useEnableAppLogin() {
  return useMutation({
    mutationFn: (data: AppLoginEnableRequest) => appLoginApi.enable(data),
  })
}

export function useDisableAppLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AppLoginDisableRequest) => appLoginApi.disable(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: appLoginKeys.me() }),
  })
}

export function useRevokeMyAppLoginDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deviceId: string) => appLoginApi.revokeMyDevice(deviceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: appLoginKeys.me() }),
  })
}

export function useAdminAppLoginStatus(userId: number, enabled = true) {
  return useQuery({
    queryKey: appLoginKeys.admin(userId),
    queryFn: () => appLoginApi.adminStatus(userId),
    enabled,
    retry: false,
  })
}

export function useAdminRevokeAllAppLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => appLoginApi.adminRevokeAll(userId),
    onSuccess: (_, userId) => {
      qc.invalidateQueries({ queryKey: appLoginKeys.admin(userId) })
      // The users table and the user's card carry the binding badge.
      qc.invalidateQueries({ queryKey: usersKeys.lists() })
      qc.invalidateQueries({ queryKey: usersKeys.detail(userId) })
    },
  })
}
