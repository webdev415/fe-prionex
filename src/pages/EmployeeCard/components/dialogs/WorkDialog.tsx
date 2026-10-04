import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/Checkbox'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import '@/components/ui/DateSelect.theme.css'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useConfirm } from '@/components/ui/useConfirm'
import { useUpdateWork } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard, ProjectAssignment } from '@/features/employeeCard/types.card'
import { useProjects } from '@/features/projects'
import {
  ProjectRoleGroupRow,
  type HeldOption,
} from '@/features/users/components/ProjectRoleGroupRow'
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

/** Where the person works, as the dialog starts from it. */
type Starting = Omit<ProjectAssignment, 'role_id'> & { role_id: number | null }

/** A position or group id per project id. */
type PerProject = Record<number, number | undefined>

/** The position as the row lists one: its name, and its department beside it. */
function heldRole(assignment: Starting): HeldOption | undefined {
  if (assignment.role_id === null) return undefined
  const name = assignment.position ?? String(assignment.role_id)
  return {
    id: assignment.role_id,
    name: assignment.department ? `${name} (${assignment.department})` : name,
    departmentId: assignment.department_id,
  }
}

function heldGroup(assignment: Starting): HeldOption | undefined {
  if (assignment.group_id === null) return undefined
  return {
    id: assignment.group_id,
    name: assignment.group ?? String(assignment.group_id),
    departmentId: assignment.department_id,
  }
}

/**
 * The Personnel Data dialog.
 *
 * Projects work as in the "Add employee" form: tick the projects the person
 * works on, and pick a position (which carries its department) and a group in
 * each. The whole set is saved at once, so unticking a project removes the
 * person from it and clears their position and group there.
 *
 * It goes the same way the user-management screen sends it, so assignments
 * are reconciled and the move reaches the chronology once. The set is sent
 * only when it differs from what the dialog opened on: a save of the hire
 * date or the manager alone leaves every membership as it is.
 *
 * The card lists every membership the person has, whatever the reader may
 * see (the contract is written on `EmployeeCard.assignments`), so the set
 * built here leaves nobody off a project by accident. A project the reader
 * may not see into comes marked `restricted`, with its ids but without its
 * names: it is shown under a neutral name, cannot be unticked here, and goes
 * back exactly as it came. A project that merely has no name (archived,
 * unnamed) is shown under the same neutral name but edits like any other.
 *
 * A server older than the project list (no `assignments` on the card) edits
 * one project only and ignores `project_assignments`. Against one the dialog
 * offers just the project the card shows and sends that project's position
 * and group the old way, so nothing chosen here is silently dropped.
 */
export function WorkDialog({ card, projectId, open, onClose }: WorkDialogProps) {
  const { t } = useTranslation()
  const mutation = useUpdateWork(card.header.id, projectId)
  const { save, error, saving } = useSectionSave(mutation, onClose)
  const { confirm, confirmDialog } = useConfirm()

  const { data: projectsData } = useProjects()
  // The manager is somebody on the employee's own project - the one the card
  // shows - and the reader's only when the employee is not on it.
  const { data: people } = useOperators(card.work.project_id ?? projectId)

  // An older server sends no list of projects and edits one project only.
  const legacy = card.assignments === undefined

  /*
   * Where the person works now. Without the list, the project the card shows
   * stands in for it - with or without a position there, which then has to be
   * chosen before saving rather than leaving the dialog with no project.
   */
  const initial: Starting[] = useMemo(() => {
    if (card.assignments) return card.assignments
    if (!card.work.project_id) return []
    return [
      {
        project_id: card.work.project_id,
        project_name: card.work.project_name,
        role_id: card.work.role_id,
        position: card.work.position,
        department_id: card.work.department_id,
        department: card.work.department,
        group_id: card.work.group_id,
        group: card.work.group,
      },
    ]
  }, [card.assignments, card.work])

  // With an older server and no project on the card, there is nothing here
  // the server could take: the section is left out and nothing of it is sent.
  const editsProjects = !legacy || initial.length > 0

  /*
   * Projects the server marks as closed to the reader: kept as they are. The
   * flag decides it, not a missing name - a project can lack a name for
   * other reasons, and such a one stays the reader's to change.
   */
  const locked = useMemo(
    () => (card.assignments ?? []).filter((assignment) => assignment.restricted === true),
    [card.assignments]
  )
  const lockedOne = (id: number) => locked.find((assignment) => assignment.project_id === id)

  /*
   * The section as it opened, so a save can tell whether it was touched at
   * all. A group never sits outside a department, and one held behind a field
   * that is not shown would still be sent.
   */
  const [start] = useState(() => ({
    projects: initial.map((assignment) => assignment.project_id),
    roles: Object.fromEntries(
      initial.map((a) => [a.project_id, a.role_id ?? undefined])
    ) as PerProject,
    groups: Object.fromEntries(
      initial.map((a) => [a.project_id, a.department_id ? (a.group_id ?? undefined) : undefined])
    ) as PerProject,
  }))
  const [selectedProjects, setSelectedProjects] = useState<number[]>(start.projects)
  const [projectRoles, setProjectRoles] = useState(start.roles)
  const [projectGroups, setProjectGroups] = useState(start.groups)
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const membershipChanged =
    selectedProjects.length !== start.projects.length ||
    selectedProjects.some(
      (id) =>
        !start.projects.includes(id) ||
        projectRoles[id] !== start.roles[id] ||
        (projectGroups[id] ?? null) !== (start.groups[id] ?? null)
    )

  /** One project as it is sent; a restricted one exactly as it came. */
  const entry = (id: number) => {
    const kept = lockedOne(id)
    return kept
      ? { project_id: id, role_id: kept.role_id, group_id: kept.group_id }
      : { project_id: id, role_id: projectRoles[id] as number, group_id: projectGroups[id] ?? null }
  }

  /*
   * The projects to offer: every one the reader can list, plus any the person
   * already works on that is not among them, so a current project never
   * disappears from the dialog just because the list leaves it out. One with
   * no name - restricted or not - is shown under a neutral one. An older
   * server can only change the project the card shows, so only that one.
   */
  const projects = useMemo(() => {
    const isLocked = (id: number) => locked.some((assignment) => assignment.project_id === id)
    const listed = legacy
      ? []
      : (projectsData?.projects ?? [])
          .filter((project) => !isLocked(project.id))
          .map((project) => ({ id: project.id, name: project.name, locked: false }))
    const held = initial
      .filter((assignment) => !listed.some((project) => project.id === assignment.project_id))
      .map((assignment) => ({
        id: assignment.project_id,
        name: assignment.project_name ?? t('pages.employeeCard.dialogs.otherProject'),
        locked: isLocked(assignment.project_id),
      }))
    return [...listed, ...held]
  }, [legacy, projectsData?.projects, initial, locked, t])

  const toggleProject = (id: number, checked: boolean) => {
    setProjectsError(null)
    setSelectedProjects((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((one) => one !== id)
    )
  }

  const [managerId, setManagerId] = useState<string>(
    card.header.manager_user_id ? String(card.header.manager_user_id) : NOBODY
  )
  const [hiredAt, setHiredAt] = useState<string>(card.work.hired_at ?? '')
  const [asterisk, setAsterisk] = useState<string>(card.work.asterisk_extension ?? '')
  const [dialer, setDialer] = useState<string>(card.work.dialer_extension ?? '')
  const [isAgent, setIsAgent] = useState<boolean>(card.work.is_agent)

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

  return (
    <SectionDialog
      open={open}
      title={t('pages.employeeCard.dialogs.work')}
      formId={FORM_ID}
      saving={saving}
      error={error}
      onClose={onClose}
    >
      {confirmDialog}
      <form
        id={FORM_ID}
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault()
          if (editsProjects) {
            // As in the "Add employee" form: at least one project, and a
            // position in each. Nobody is left without a project from here.
            if (selectedProjects.length === 0) {
              setProjectsError(t('pages.users.forms.errors.selectAtLeastOneProject'))
              return
            }
            if (selectedProjects.some((id) => projectRoles[id] === undefined)) {
              setProjectsError(t('pages.users.forms.errors.assignRoleForEachProject'))
              return
            }
            setProjectsError(null)
          }

          /*
           * Asked before saving, not after: one click on a checkbox, then a
           * save for some other reason, takes the person off a project and
           * clears their position and group there. Nothing brings those back
           * but somebody who remembers them.
           */
          const dropped = initial.filter(
            (assignment) => !selectedProjects.includes(assignment.project_id)
          )
          if (dropped.length > 0) {
            const agreed = await confirm({
              title: t('pages.employeeCard.dialogs.removeProjectsTitle'),
              message: t('pages.employeeCard.dialogs.removeProjectsMessage', {
                projects: dropped
                  .map(
                    (assignment) =>
                      projects.find((project) => project.id === assignment.project_id)?.name ??
                      String(assignment.project_id)
                  )
                  .join(', '),
              }),
              confirmLabel: t('pages.employeeCard.dialogs.removeProjectsConfirm'),
              tone: 'danger',
            })
            if (!agreed) return
          }

          const [shown] = selectedProjects
          void save({
            // Untouched, the section is not sent: the server then leaves
            // every membership as it is.
            ...(!editsProjects || !membershipChanged
              ? {}
              : legacy
                ? // One project, the old way: the server reads these and not
                  // the list. A group of null clears one.
                  {
                    project_id: shown,
                    role_id: projectRoles[shown] as number,
                    group_id: projectGroups[shown] ?? null,
                  }
                : {
                    // The whole set: a project left out is removed, and its
                    // position and group with it. A group of null clears one.
                    project_assignments: selectedProjects.map(entry),
                  }),
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
        {editsProjects && (
          <div className="space-y-3 sm:col-span-2">
            <span className="text-muted-foreground text-xs">
              {t('pages.users.forms.assignProjects')}
            </span>
            <div className="flex flex-wrap gap-4">
              {projects.map((project) => (
                <label
                  key={project.id}
                  className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedProjects.includes(project.id)}
                    disabled={project.locked}
                    onCheckedChange={(checked) => toggleProject(project.id, checked === true)}
                  />
                  <span>{project.name}</span>
                </label>
              ))}
            </div>
            {selectedProjects.some((id) => !lockedOne(id)) && (
              <div className="space-y-3">
                <span className="text-muted-foreground text-xs">
                  {t('pages.users.forms.rolePerProject')}
                </span>
                {/* A restricted project has nothing here to choose: its
                    position and group are not the reader's to see. */}
                {selectedProjects
                  .filter((id) => !lockedOne(id))
                  .map((id) => {
                    // What the person holds there now stays offered even once it
                    // has been deactivated, so the row opens on what is saved.
                    const current = initial.find((assignment) => assignment.project_id === id)
                    return (
                      <ProjectRoleGroupRow
                        key={id}
                        projectId={id}
                        projectName={projects.find((project) => project.id === id)?.name}
                        selectedRoleId={projectRoles[id]}
                        selectedGroupId={projectGroups[id]}
                        heldRole={current && heldRole(current)}
                        heldGroup={current && heldGroup(current)}
                        onRoleChange={(roleId) => {
                          setProjectsError(null)
                          setProjectRoles((prev) => ({ ...prev, [id]: roleId }))
                        }}
                        onGroupChange={(groupId) =>
                          setProjectGroups((prev) => ({ ...prev, [id]: groupId }))
                        }
                      />
                    )
                  })}
              </div>
            )}
            {projectsError && (
              <p role="alert" className="text-error-500 text-sm">
                {projectsError}
              </p>
            )}
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
            obscured
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
