import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/Checkbox'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import '@/components/ui/DateSelect.theme.css'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useDepartments } from '@/features/departments'
import { useUpdateWork } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { useGroups } from '@/features/groups'
import { useRoles } from '@/features/roles'
import { useOperators } from '@/features/users/hooks/useUsers'
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'
import { SectionDialog } from './SectionDialog'
import { useSectionSave } from './useSectionSave'

export interface WorkDialogProps {
  card: EmployeeCard
  projectId: number | null
  open: boolean
  onClose: () => void
}

const FORM_ID = 'employee-card-work'
const NOBODY = 'none'
const MANAGER_FIELD = 'employee-card-manager'

/**
 * The Personnel Data dialog.
 *
 * Position and department are not independent: a role already belongs to a
 * department, so choosing a department narrows the positions rather than
 * standing beside them. Offering both freely is what lets somebody pick a
 * pair that describes nothing, which the server then has to refuse.
 *
 * Changing a position here goes the same way the user-management screen sends
 * it, so assignments are reconciled and the move reaches the chronology once.
 */
export function WorkDialog({ card, projectId, open, onClose }: WorkDialogProps) {
  const { t } = useTranslation()
  const mutation = useUpdateWork(card.header.id, projectId)
  const { save, error, saving } = useSectionSave(mutation, onClose)

  const { data: departmentsData } = useDepartments({
    page: 1,
    page_size: 100,
    is_active: true,
  })
  const { data: rolesData } = useRoles({ page: 1, page_size: 100, is_active: true })
  const { data: people } = useOperators(projectId ?? card.work.project_id)

  const [departmentId, setDepartmentId] = useState<string>(
    card.work.department_id ? String(card.work.department_id) : NOBODY
  )
  const [roleId, setRoleId] = useState<string>(card.work.role_id ? String(card.work.role_id) : '')
  // Only with a department: a group never sits outside one, and a value held
  // behind a field that is not shown would still be sent.
  const [groupId, setGroupId] = useState<string>(
    card.work.group_id && card.work.department_id ? String(card.work.group_id) : NOBODY
  )
  const [managerId, setManagerId] = useState<string>(
    card.header.manager_user_id ? String(card.header.manager_user_id) : NOBODY
  )
  const [hiredAt, setHiredAt] = useState<string>(card.work.hired_at ?? '')
  const [asterisk, setAsterisk] = useState<string>(card.work.asterisk_extension ?? '')
  const [dialer, setDialer] = useState<string>(card.work.dialer_extension ?? '')
  const [isAgent, setIsAgent] = useState<boolean>(card.work.is_agent)

  /*
   * The same narrowing the user-management screen applies: the active groups
   * of the chosen department. A group is never outside a department, so with
   * none chosen there is nothing to ask for.
   */
  const { data: groupsData } = useGroups(
    {
      department_id: departmentId === NOBODY ? undefined : Number(departmentId),
      page: 1,
      page_size: 100,
      is_active: true,
    },
    departmentId !== NOBODY
  )

  const roles = useMemo(() => rolesData?.roles ?? [], [rolesData?.roles])
  /*
   * Nobody is an option, and it heads the list rather than being buried among
   * the names: removing a manager is a thing somebody comes here to do.
   */
  const managers = useMemo(() => {
    const loaded = (people ?? [])
      .filter((person) => person.id !== card.header.id)
      .map((person) => ({
        id: String(person.id),
        name: person.full_name || person.username,
      }))
    const current = card.header.manager_user_id
    const held =
      current && !loaded.some((one) => one.id === String(current))
        ? [{ id: String(current), name: card.header.manager ?? String(current) }]
        : []
    return [{ id: NOBODY, name: t('pages.employeeCard.dialogs.noManager') }, ...held, ...loaded]
  }, [people, card.header.id, card.header.manager_user_id, card.header.manager, t])

  /*
   * The department is not a field on the employee - it follows from their
   * role, and the server only reads it here to check the two agree. What this
   * select really does is narrow the list of positions below it.
   *
   * So "no department" heads the list as the roles that belong to no
   * department: Admin, collector, manager and the rest, 25 of the 39 roles
   * here. Leaving it out stranded anybody holding one of them, because no
   * department could be chosen that would list their own position.
   */
  const departments = useMemo(
    () => [
      { id: NOBODY, name: t('pages.employeeCard.dialogs.noDepartment') },
      ...(departmentsData?.departments ?? []).map((department) => ({
        id: String(department.id),
        name: department.name,
      })),
    ],
    [departmentsData, t]
  )

  const positions = useMemo(
    () =>
      departmentId === NOBODY
        ? roles.filter((role) => role.department_id == null)
        : roles.filter((role) => String(role.department_id ?? '') === departmentId),
    [roles, departmentId]
  )

  /*
   * "No group" heads the list, like "no manager": leaving a group is a thing
   * somebody comes here to do.
   *
   * The person's own group is kept on top of the loaded ones while their
   * department is still the one chosen, the way the manager is. A group that
   * has since been deactivated is not in the active list, and without this the
   * field would open empty rather than on where they actually sit.
   */
  const groups = useMemo(() => {
    const loaded = (groupsData?.groups ?? []).map((group) => ({
      id: String(group.id),
      name: group.name,
    }))
    const current = card.work.group_id
    const held =
      current &&
      departmentId === String(card.work.department_id ?? '') &&
      !loaded.some((one) => one.id === String(current))
        ? [{ id: String(current), name: card.work.group ?? String(current) }]
        : []
    return [{ id: NOBODY, name: t('pages.employeeCard.dialogs.noGroup') }, ...held, ...loaded]
  }, [
    groupsData?.groups,
    card.work.group_id,
    card.work.group,
    card.work.department_id,
    departmentId,
    t,
  ])

  /*
   * The group sits on the assignment beside the position, so it is offered
   * only once there is a position to hold it. A department change clears the
   * position, and a group picked before a new one is chosen would not be sent -
   * showing and sending on the same condition keeps what is seen what is saved.
   */
  const showGroup = departmentId !== NOBODY && roleId !== ''

  return (
    <SectionDialog
      open={open}
      title={t('pages.employeeCard.dialogs.work')}
      formId={FORM_ID}
      saving={saving}
      error={error}
      onClose={onClose}
    >
      <form
        id={FORM_ID}
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          void save({
            ...(projectId ? { project_id: projectId } : {}),
            ...(roleId ? { role_id: Number(roleId) } : {}),
            ...(departmentId === NOBODY ? {} : { department_id: Number(departmentId) }),
            // The group sits on the assignment beside the position, so it is
            // sent with one. Null rather than omitted, so choosing "no group"
            // removes it instead of leaving the old one in place.
            ...(roleId
              ? { group_id: showGroup && groupId !== NOBODY ? Number(groupId) : null }
              : {}),
            manager_user_id: managerId === NOBODY ? null : Number(managerId),
            hired_at: hiredAt || null,
            // Empty clears it. Sent as null rather than omitted, so somebody
            // who deletes a number gets it removed instead of silently kept.
            asterisk_extension: asterisk.trim() || null,
            dialer_extension: dialer.trim() || null,
            is_agent: isAgent,
          })
        }}
      >
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {t('pages.employeeCard.fields.department')}
          </span>
          <Select
            value={departmentId}
            onValueChange={(value) => {
              setDepartmentId(value)
              setRoleId('')
              setGroupId(NOBODY)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('pages.employeeCard.dialogs.choose')} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {t('pages.employeeCard.fields.position')}
          </span>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.employeeCard.dialogs.choose')} />
            </SelectTrigger>
            <SelectContent>
              {positions.map((role) => (
                <SelectItem key={role.id} value={String(role.id)}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hidden rather than disabled, as on the user-management screen:
            without a department and a position there is no group to hold. */}
        {showGroup && (
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs">
              {t('pages.employeeCard.fields.group')}
            </span>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder={t('pages.employeeCard.dialogs.choose')} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          {/* A real label, not a span beside it: the picker is a button rather
              than a native select, so without one it has no accessible name at
              all - a screen reader would announce whichever name happens to be
              chosen and nothing about what it is choosing. */}
          <label htmlFor={MANAGER_FIELD} className="text-muted-foreground block text-xs">
            {t('pages.employeeCard.fields.manager')}
          </label>
          {/*
            Searchable, unlike the two above it. Department and position are
            short lists somebody can read; every employee is not, and picking a
            manager out of it by scrolling means knowing where in the order
            they fall.

            The roster is every user on the project, unpaginated, so the
            filtering can stay local and nobody falls off the end of a page.
            The card's own manager is added on top of it, because somebody who
            has since left the project must still show as the current answer
            rather than as an empty field.
          */}
          <SearchableSelect
            id={MANAGER_FIELD}
            options={managers}
            value={managerId}
            onValueChange={setManagerId}
            placeholder={t('pages.employeeCard.dialogs.choose')}
            searchPlaceholder={t('pages.employeeCard.dialogs.searchManager')}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {t('pages.employeeCard.fields.hiredAt')}
          </span>
          <DateSelect
            value={parsePickerYMD(hiredAt)}
            onChange={({ value }) => setHiredAt(value ? formatPickerDateAsYMD(value) : '')}
            format="dd.MM.yyyy"
            allowManualInput
            placeholder={t('pages.employeeCard.fields.hiredAt')}
          />
        </div>

        {/*
          Digits only, 3 to 10, matching what the create-user dialog asks for
          and what the service accepts. Clearing one and saving removes it.
        */}
        <Input
          label={t('pages.employeeCard.fields.asteriskExtension')}
          value={asterisk}
          inputMode="numeric"
          maxLength={10}
          onChange={(event) => setAsterisk(event.target.value)}
          helperText={t('pages.employeeCard.fields.extensionHint')}
        />

        <Input
          label={t('pages.employeeCard.fields.dialerExtension')}
          value={dialer}
          inputMode="numeric"
          maxLength={10}
          onChange={(event) => setDialer(event.target.value)}
          helperText={t('pages.employeeCard.fields.extensionHint')}
        />

        {/*
          Sits with the dialer extension it gates. An agent with no extension
          is not provisioned, and an extension on somebody who is not an agent
          is not either, so editing one without the other is a change that
          quietly does nothing.
        */}
        <label className="flex items-center gap-2 self-end pb-2 sm:col-span-2">
          <Checkbox checked={isAgent} onCheckedChange={(value) => setIsAgent(value === true)} />
          <span className="text-foreground text-sm">{t('pages.employeeCard.fields.isAgent')}</span>
        </label>
      </form>
    </SectionDialog>
  )
}
