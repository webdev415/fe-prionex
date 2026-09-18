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
 * same tab would attribute the whole session to whoever logged in last. And
 * `stop()` alone is not enough: the session token survives in `sessionStorage`,
 * so a bare `start()` — including the one on the next page load — CONTINUES the
 * old session. Verified in `@openreplay/tracker@18.0.6`.
 *
 * The rule is therefore about OWNERSHIP, remembered where the tracker remembers
 * its session: per tab, in `sessionStorage`. Whenever an identity is applied,
 * the actor's id is written to `OWNER_KEY`; on an observed logout it is
 * removed. When somebody signs in and the tab's session is not theirs — no
 * owner recorded but a session that predates them, or a different owner — the
 * session is stopped and a new one opened with `forceNew` and their id. Two
 * sessions, two honest ids. A fresh tab, where nothing predates them, adopts
 * the session the page load opened.
 *
 * Why per tab and not "was there a CRM token at boot": the CRM token is in
 * `localStorage`, shared by every tab, while the replay session is per tab. X
 * signs out in tab A, Y signs in there, then reloads X's still-open tab B —
 * the token says Y, tab B's session says X, and a token-based rule would have
 * renamed X's screens to Y. The owner key is what tab B remembers on its own
 * (Fable review of this pass).
 *
 * The paths this has to hold on, because none of them is an in-page logout
 * this module could observe: the 401 interceptor and the cross-tab listener
 * in `lib/api.ts` leave via `window.location.href`; a stale tab reloaded by a
 * different operator; a fresh operator on a login screen the previous one
 * left. In every one of them the owner key still names the previous operator,
 * and the next login sees the mismatch.
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

/**
 * Where this tab remembers whose session it is running. `sessionStorage`, like
 * the tracker's own session token, so the two are scoped identically: per tab,
 * surviving a reload, gone when the tab closes.
 */
export const OWNER_KEY = 'openreplay_owner'

/**
 * The tracker's own session token key (`@openreplay/tracker@18.0.6`,
 * `session_token_key`). Read once at bind time to tell a FRESH tab — no token,
 * nothing to inherit — from a tab that is continuing somebody's session.
 */
const REPLAY_TOKEN_KEY = '__openreplay_token'

function hasReplayToken(): boolean {
  try {
    return window.sessionStorage.getItem(REPLAY_TOKEN_KEY) !== null
  } catch {
    return false
  }
}

/** Storage can be absent or throw (private mode, cleared site data). */
function readOwner(): string | null {
  try {
    return window.sessionStorage.getItem(OWNER_KEY)
  } catch {
    return null
  }
}

function writeOwner(actorId: string | null): void {
  try {
    if (actorId === null) window.sessionStorage.removeItem(OWNER_KEY)
    else window.sessionStorage.setItem(OWNER_KEY, actorId)
  } catch {
    // Without storage every login restarts the session, which is the safe
    // direction: attribution stays honest, at the cost of shorter sessions.
  }
}

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
  // Whether this tab was CONTINUING a replay session when the page loaded.
  // Read before the page-load start can write a token of its own: a fresh tab
  // has neither an owner nor a token, and the session the page-load start opens
  // there is nobody's yet — the first login can simply adopt it. Restarting it
  // instead produced one anonymous two-second stub session per new tab (Fable
  // review of this pass).
  const continuingAtBoot = hasReplayToken()
  // Applications are serialised: the store can change while an earlier
  // `await getTracker()` is still pending, and the last write must win.
  let queue: Promise<void> = Promise.resolve()

  const metadataOf = (id: Identity): Record<string, string> => ({
    role: id.role,
    project: id.project,
    department: id.department,
    impersonating: id.impersonating,
  })

  type AuthSnapshot = Parameters<typeof identityFrom>[0]

  // 🔴 The snapshot is taken at EVENT time and carried into the queue. Reading
  // the store when the queued step finally runs collapsed a logout+login that
  // happened while the first start was pending into a single "re-identify the
  // same session" step — the store already held the second user by then, so no
  // logout was ever seen, no stop issued, and the session kept its old token
  // with a new owner. Exactly the mis-attribution the module exists to prevent,
  // reached through the queue that was meant to make it safe.
  const apply = (state: AuthSnapshot) =>
    (queue = queue.then(async () => {
      const next = identityFrom(state)
      if (same(next, applied)) return

      if (!next) {
        // Observed logout. Stop rather than leave the session open for the next
        // login to overwrite, and forget the owner — the tab's session is
        // nobody's now. `applied` was non-null, so somebody really was signed
        // in: a page that loaded with nobody never reaches this branch.
        applied = null
        writeOwner(null)
        stopOpenReplay()
        return
      }

      const owner = readOwner()
      if (
        applied === null &&
        owner !== next.actorId &&
        // A fresh tab (no owner, no token at boot) has nothing to inherit: the
        // page-load session is adopted below rather than replaced.
        (owner !== null || continuingAtBoot)
      ) {
        // Somebody signed in, and this tab's session is not theirs: nobody
        // owned it but it predates them (a login screen after a logout of any
        // kind — the previous operator's token still continues it), or
        // somebody else did (a stale tab reloaded by another operator). Close
        // it and open one that is theirs. `stopOpenReplay` is a no-op when
        // nothing is running; the identity goes in WITH the start, so the new
        // session has an owner from its first frame.
        stopOpenReplay()
        startOpenReplay({
          forceNew: true,
          userID: next.actorId,
          metadata: metadataOf(next),
        })
      }
      // The remaining `applied === null` cases: the recorded owner IS this
      // operator (a reload — the session is continued across the navigation on
      // purpose), or the tab is fresh and its new session is simply adopted.
      // Either way only the identity is (re)applied below.

      const tracker = await getTracker()
      applied = next
      writeOwner(next.actorId)
      if (!tracker) return

      // Idempotent on the start above; needed for the reload case, where the
      // tracker was already running before the store was hydrated, and for every
      // later change (impersonation begins, role switches) within a session.
      tracker.setUserID(next.actorId)
      for (const [key, value] of Object.entries(metadataOf(next))) {
        tracker.setMetadata(key, value)
      }
    }))

  void apply(useAuthStore.getState())
  return useAuthStore.subscribe((state) => void apply(state))
}
