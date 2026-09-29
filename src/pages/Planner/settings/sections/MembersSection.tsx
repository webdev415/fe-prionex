/**
 * «Учасники» (planner story 5.10, AC3; UX C-08, FR-5, PRD A-96).
 *
 * - Computed participants of a department board — the head of the department
 *   in the CRM («керівник відділу в CRM») and its members — are marked «з
 *   відділу» and read only: the org mirror decides them, and the head cannot be
 *   removed.
 * - Explicit participants get a role (Член / Гість / Адмін) and «Прибрати».
 *   Who may do what is the server's: the role «Адмін» is offered, and explicit
 *   admins are changed, only with `manage_admins` in the board's
 *   `allowed_actions` (the head of the department and `planner.admin`; an
 *   explicit admin gets 403); members and guests — with `manage_members`.
 * - «Не у відділі» — an explicit admin who was in the department and left it
 *   (`not_in_department`); a fallback admin from elsewhere has no mark.
 * - A person of the department itself cannot be added explicitly: the server
 *   answers 409 `already_member`, and the form says «Вже учасник з відділу».
 * - A stale org snapshot on a department board (older than the planner's
 *   15 minutes, or none yet; or the server's 409 `org_stale`) — a banner, and
 *   the role «Адмін» inactive in the lists with the reason.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { piiProps } from '@/lib/openreplay/pii'
import {
  PLANNER_ORG_STALE_MINUTES,
  type PlannerBoard,
  type PlannerBoardMember,
  type PlannerBoardMemberRole,
  type PlannerPerson,
} from '@/api/planner/plannerApi'
import { PeoplePicker } from '../../components/PeoplePicker'
import { PersonAvatar } from '../../components/PersonAvatar'
import { PlannerBanners } from '../../components/PlannerStates'
import { personName } from '../../plannerFormat'
import { useSettingsText } from '../settingsText'
import { SectionHeading, SettingsSelect } from '../settingsUi'
import { useBoardMemberCommands, type MemberFailure } from '../useBoardSettingsMutations'

const ROLES: PlannerBoardMemberRole[] = ['board_member', 'board_guest', 'board_admin']
const BADGE =
  'border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs'

export function MembersSection({ board }: { board: PlannerBoard }) {
  const { t } = useSettingsText()
  const [person, setPerson] = useState<PlannerPerson[]>([])
  const [role, setRole] = useState<PlannerBoardMemberRole>('board_member')
  const [addError, setAddError] = useState<string | undefined>()
  const [serverSaidStale, setServerSaidStale] = useState(false)

  const onFailure = (reason: MemberFailure) => {
    if (reason === 'already_member') setAddError(t('settings.members.alreadyMember'))
    if (reason === 'org_stale') setServerSaidStale(true)
  }
  const { put, remove } = useBoardMemberCommands(board.code, onFailure)
  const busy = put.isPending || remove.isPending

  const manageAdmins = board.allowed_actions.includes('manage_admins')
  const manageMembers = board.allowed_actions.includes('manage_members')
  const age = board.org_snapshot_age_minutes
  const orgStale =
    board.kind === 'department' &&
    (serverSaidStale || age === null || age > PLANNER_ORG_STALE_MINUTES)
  const canAssignAdmins = manageAdmins && !orgStale
  // With a stale snapshot «Адмін» stays in the list, inactive, with the reason.
  const adminBlocked = manageAdmins && orgStale
  const blockedAdmin = adminBlocked && (
    <option value="board_admin" disabled>
      {t('settings.members.adminUnavailable')}
    </option>
  )
  const offered = ROLES.filter((item) => item !== 'board_admin' || canAssignAdmins)
  // Adding: members and guests need `manage_members`, an admin `manage_admins`.
  const addRoles = offered.filter((item) => item === 'board_admin' || manageMembers)
  const addRole = addRoles.includes(role) ? role : addRoles[0]

  const computed = board.members.filter((member) => member.source !== 'explicit')
  const explicit = board.members.filter((member) => member.source === 'explicit')
  const canEdit = (member: PlannerBoardMember) =>
    member.role === 'board_admin' ? canAssignAdmins : manageMembers

  const changeRole = (member: PlannerBoardMember, next: PlannerBoardMemberRole) =>
    put.mutate(
      { userId: member.user_id, version: board.version, role: next },
      { onSuccess: () => toast.success(t('settings.toast.roleChanged')) }
    )

  const add = () => {
    const [chosen] = person
    if (!chosen || !addRole) return
    setAddError(undefined)
    put.mutate(
      { userId: chosen.user_id, version: board.version, role: addRole },
      {
        onSuccess: () => {
          setPerson([])
          setRole('board_member')
          toast.success(t('settings.toast.memberAdded'))
        },
      }
    )
  }

  const staleText =
    age === null ? t('settings.members.orgNever') : t('settings.members.orgStale', { minutes: age })

  return (
    <section className="space-y-4" aria-labelledby="planner-settings-members">
      <SectionHeading
        id="planner-settings-members"
        title={t('settings.sections.members')}
        hint={t('settings.members.adminHint')}
      />
      <PlannerBanners
        banners={orgStale ? [{ reason: 'org-stale', tone: 'warning', text: staleText }] : []}
      />

      {computed.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-foreground text-sm font-medium">
            {t('settings.members.computedTitle')}
          </h4>
          <ul className="space-y-1" {...piiProps}>
            {computed.map((member) => (
              <li
                key={member.user_id}
                data-member-row={member.user_id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <PersonAvatar person={member} decorative />
                <span className="text-foreground">{personName(member)}</span>
                <span className={BADGE}>{t('settings.members.fromDepartment')}</span>
                <span className="text-muted-foreground text-xs">
                  {member.source === 'department_manager'
                    ? t('settings.members.departmentManager')
                    : t(`settings.members.roles.${member.role}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-foreground text-sm font-medium">
          {t('settings.members.explicitTitle')}
        </h4>
        {explicit.length === 0 && (
          <p className="text-muted-foreground text-sm">{t('settings.members.empty')}</p>
        )}
        <ul className="space-y-1" {...piiProps}>
          {explicit.map((member) => {
            const editable = canEdit(member)
            const name = personName(member)
            return (
              <li
                key={member.user_id}
                data-member-row={member.user_id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <PersonAvatar person={member} decorative />
                <span className="text-foreground">{name}</span>
                {member.not_in_department && (
                  <span className={BADGE}>{t('settings.members.notInDepartment')}</span>
                )}
                {editable ? (
                  <SettingsSelect
                    aria-label={t('settings.members.role')}
                    value={member.role}
                    disabled={busy}
                    onChange={(event) =>
                      changeRole(member, event.target.value as PlannerBoardMemberRole)
                    }
                  >
                    {ROLES.filter((item) => offered.includes(item) || item === member.role).map(
                      (item) => (
                        <option key={item} value={item}>
                          {t(`settings.members.roles.${item}`)}
                        </option>
                      )
                    )}
                    {blockedAdmin}
                  </SettingsSelect>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {t(`settings.members.roles.${member.role}`)}
                  </span>
                )}
                {editable && (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      remove.mutate({ userId: member.user_id, version: board.version })
                    }
                  >
                    {t('settings.members.removeButton')}
                    <span className="sr-only"> {name}</span>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {addRoles.length > 0 && (
        <div className="border-border max-w-xl space-y-2 rounded-lg border p-3">
          <p className="text-foreground text-sm font-medium">{t('settings.members.add')}</p>
          <PeoplePicker
            value={person}
            onChange={(next) => {
              setPerson(next)
              setAddError(undefined)
            }}
            max={1}
            label={t('settings.members.person')}
            placeholder={t('settings.members.addPlaceholder')}
          />
          {addError && (
            <p className="text-error-700 text-xs" role="alert">
              {addError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <SettingsSelect
              aria-label={t('settings.members.role')}
              value={addRole}
              onChange={(event) => setRole(event.target.value as PlannerBoardMemberRole)}
            >
              {addRoles.map((item) => (
                <option key={item} value={item}>
                  {t(`settings.members.roles.${item}`)}
                </option>
              ))}
              {blockedAdmin}
            </SettingsSelect>
            <Button size="sm" disabled={person.length === 0 || busy} onClick={add}>
              {t('settings.members.addButton')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

export default MembersSection
