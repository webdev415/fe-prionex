/**
 * Turns a preset's relative employee scope into the ids it means right now
 * (#1100).
 *
 * This is the callback `resolvePresetToFilters` asks for, and the reason presets
 * store a scope rather than a list: membership is read when the preset is
 * applied, so somebody joining the operator's group is covered by a preset saved
 * before they arrived.
 *
 * "My group" and "my department" are the operator's *active* group and
 * department. An operator with neither resolves those scopes to nobody, which
 * the resolver then treats as no filter at all — the alternative, silently
 * falling back to everyone, would widen a preset instead of narrowing it.
 */

import { useCallback } from 'react'

import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'

import type { RelativeEmployeeScope } from '../types'

export function useResolveEmployeeScope(projectId: number | null) {
  const user = useAuthStore((state) => state.user)
  // includeInactive, matching the client list's own option set: a preset may
  // legitimately name an operator who has since been blocked.
  const { data: operators } = useOperators(projectId, { includeInactive: true })

  const myId = user?.id ? Number(user.id) : null
  const myGroupId = user?.active_group_id ?? null
  const myDepartmentId = user?.active_department_id ?? null

  return useCallback(
    (scope: RelativeEmployeeScope): number[] => {
      const all = operators ?? []

      switch (scope) {
        case 'myGroup':
          if (myGroupId === null) return []
          return all.filter((o) => o.group_id === myGroupId).map((o) => o.id)
        case 'myDepartment':
          if (myDepartmentId === null) return []
          return all.filter((o) => o.department_id === myDepartmentId).map((o) => o.id)
        case 'everyoneExceptMe':
          if (myId === null) return all.map((o) => o.id)
          return all.filter((o) => o.id !== myId).map((o) => o.id)
        case 'everyoneExceptMyGroup':
          // With no group of their own, "everyone except my group" is everyone —
          // there is no group to take out.
          if (myGroupId === null) return all.map((o) => o.id)
          return all.filter((o) => o.group_id !== myGroupId).map((o) => o.id)
        case 'everyoneExceptMyDepartment':
          if (myDepartmentId === null) return all.map((o) => o.id)
          return all.filter((o) => o.department_id !== myDepartmentId).map((o) => o.id)
      }
    },
    [operators, myId, myGroupId, myDepartmentId]
  )
}
