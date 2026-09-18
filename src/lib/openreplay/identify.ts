/**
 * Who was at the keyboard — the operator identity on an OpenReplay session.
 *
 * Without this a session is a stream of masked screens with no owner: it can be
 * watched but not attributed, and "which operator did this" is the first
 * question anyone opens a recording with.
 *
 * 🔴 THE ID, AND ONLY THE ID. `setUserID` gets `user.id` — never the username,
 * the e-mail or the full name. KAN-KB-54 spent a hundred edits keeping personal
 * data out of the recordings; putting the operator's name into the session's
 * own header would open the same hole from the other side. A numeric id is a
 * pseudonym: anyone with CRM access resolves `1042` at
 * `/dashboard/team-management/users/1042`, and anyone without it learns
 * nothing.
 *
 * 🔴 IMPERSONATION: THE ADMIN, NOT THE TARGET. When an admin acts as another
 * user, `useAuthStore.user` carries the TARGET's role and permissions (that is
 * what the permission gates read), while `originalAdminUser` is the person who
 * actually sat at the keyboard. The session's user id is about accountability,
 * so it names the admin; the target goes into metadata. Getting this backwards
 * attributes an admin's actions to someone who did nothing.
 *
 * ⚠️ A SESSION IS ONE PER TAB AND THE TRACKER HAS NO "UNSET". A second
 * `setUserID` overwrites the first, so a logout followed by another login in the
 * same tab would attribute the whole session to whoever logged in last. On
 * logout the tracker is therefore STOPPED, and the next login starts a new one:
 * two sessions, two honest ids. This matters on shared workstations, which in
 * a call centre is most of them.
 *
 * ⚠️ Metadata keys must be DECLARED in the OpenReplay project settings first
 * (Project → Metadata, at most 10). An undeclared key is dropped by the backend
 * without an error. The keys this module sends are listed in
 * `METADATA_KEYS` so the two cannot drift apart unnoticed.
 */

import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { getTracker, startOpenReplay, stopOpenReplay } from './index'

/**
 * Every metadata key this module writes. Declare each one in the OpenReplay
 * project before expecting to filter by it.
 *
 * None of these is personal data: a role name, a project id, a department id
 * and the id of an impersonated user are all resolvable only through the CRM.
 */
export const METADATA_KEYS = ['role', 'project', 'department', 'impersonating'] as const

interface Identity {
  /** The person at the keyboard. */
  actorId: string
  role: string
  project: string
  department: string
  /** The user being acted as, when impersonating; empty otherwise. */
  impersonating: string
}

/**
 * The identity the auth store currently describes, or `null` when nobody is
 * signed in.
 *
 * Pure and exported for the tests: the decision of WHO the session belongs to
 * is the whole point of this module, and it should be checkable without a
 * tracker, a store subscription or a timer in the way.
 */
export function identityFrom(state: {
  user: User | null
  isImpersonating: boolean
  originalAdminUser: User | null
  impersonatedUser: User | null
}): Identity | null {
  const actor = state.isImpersonating ? (state.originalAdminUser ?? state.user) : state.user
  if (!actor) return null
  return {
    actorId: actor.id,
    role: actor.active_role_name ?? '',
    project: actor.active_project_id ?? '',
    department: actor.active_department_id != null ? String(actor.active_department_id) : '',
    impersonating: state.isImpersonating ? (state.impersonatedUser?.id ?? '') : '',
  }
}

/** Two identities describe the same session owner. */
function same(a: Identity | null, b: Identity | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.actorId === b.actorId &&
    a.role === b.role &&
    a.project === b.project &&
    a.department === b.department &&
    a.impersonating === b.impersonating
  )
}

/**
 * Keep the running session's identity in step with the auth store.
 *
 * Returns the unsubscribe function. Idempotent per call — the caller
 * (`startOpenReplay`) already guards against a second start.
 */
export function bindOperatorIdentity(): () => void {
  let applied: Identity | null = null
  // Applications are serialised: the store can change while an earlier
  // `await getTracker()` is still pending, and the last write must win.
  let queue: Promise<void> = Promise.resolve()

  const apply = () =>
    (queue = queue.then(async () => {
      const next = identityFrom(useAuthStore.getState())
      if (same(next, applied)) return

      if (!next) {
        // Logout. Stop rather than leave the session open for the next login
        // to overwrite — see the module header.
        applied = null
        stopOpenReplay()
        return
      }

      if (applied === null) {
        // Login, or the first application after a start. `startOpenReplay` is
        // a no-op while a tracker is already running, so this is safe to call
        // on every transition from "nobody" to "somebody".
        startOpenReplay()
      }

      const tracker = await getTracker()
      applied = next
      if (!tracker) return

      tracker.setUserID(next.actorId)
      tracker.setMetadata('role', next.role)
      tracker.setMetadata('project', next.project)
      tracker.setMetadata('department', next.department)
      tracker.setMetadata('impersonating', next.impersonating)
    }))

  void apply()
  return useAuthStore.subscribe(() => void apply())
}
