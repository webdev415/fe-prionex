import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/Checkbox'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
import '@/components/ui/DateSelect.theme.css'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useUpdateWork } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard, ProjectAssignment } from '@/features/employeeCard/types.card'
import { useProjects } from '@/features/projects'
import { ProjectRoleGroupRow } from '@/features/users/components/ProjectRoleGroupRow'
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
 * Projects work as in the "Add employee" form: tick the projects the person
 * works on, and pick a position (which carries its department) and a group in
 * each. The whole set is saved at once, so unticking a project removes the
 * person from it and clears their position and group there.
 *
 * It goes the same way the user-management screen sends it, so assignments
 * are reconciled and the move reaches the chronology once.
 */
export function WorkDialog({ card, projectId, open, onClose }: WorkDialogProps) {
  const { t } = useTranslation()
  const mutation = useUpdateWork(card.header.id, projectId)
  const { save, error, saving } = useSectionSave(mutation, onClose)

  const { data: projectsData } = useProjects()
  const { data: people } = useOperators(projectId ?? card.work.project_id)

  /*
   * Where the person works now. An older server sends no list, so the one
   * project shown on the card stands in for it.
   */
  const initial: ProjectAssignment[] = useMemo(
    () =>
      card.assignments ??
      (card.work.project_id && card.work.role_id
        ? [
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
        : []),
    [card.assignments, card.work]
  )

  const [selectedProjects, setSelectedProjects] = useState<number[]>(() =>
    initial.map((assignment) => assignment.project_id)
  )
  const [projectRoles, setProjectRoles] = useState<Record<number, number | undefined>>(() =>
    Object.fromEntries(initial.map((a) => [a.project_id, a.role_id]))
  )
  const [projectGroups, setProjectGroups] = useState<Record<number, number | undefined>>(() =>
    Object.fromEntries(initial.map((a) => [a.project_id, a.group_id ?? undefined]))
  )
  const [projectsError, setProjectsError] = useState<string | null>(null)

  /*
   * The projects to offer: every one the reader can list, plus any the person
   * already works on that is not among them, so a current project never
   * disappears from the dialog just because the list leaves it out.
   */
  const projects = useMemo(() => {
    const listed = (projectsData?.projects ?? []).map((project) => ({
      id: project.id,
      name: project.name,
    }))
    const held = initial
      .filter((assignment) => !listed.some((project) => project.id === assignment.project_id))
      .map((assignment) => ({
        id: assignment.project_id,
        name: assignment.project_name ?? String(assignment.project_id),
      }))
    return [...listed, ...held]
  }, [projectsData?.projects, initial])

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
      <form
        id={FORM_ID}
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
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
          void save({
            // The whole set: a project left out is removed, and its position
            // and group with it. A group of null clears one.
            project_assignments: selectedProjects.map((id) => ({
              project_id: id,
              role_id: projectRoles[id] as number,
              group_id: projectGroups[id] ?? null,
            })),
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
                  onCheckedChange={(checked) => toggleProject(project.id, checked === true)}
                />
                <span>{project.name}</span>
              </label>
            ))}
          </div>
          {selectedProjects.length > 0 && (
            <div className="space-y-3">
              <span className="text-muted-foreground text-xs">
                {t('pages.users.forms.rolePerProject')}
              </span>
              {selectedProjects.map((id) => (
                <ProjectRoleGroupRow
                  key={id}
                  projectId={id}
                  projectName={projects.find((project) => project.id === id)?.name}
                  selectedRoleId={projectRoles[id]}
                  selectedGroupId={projectGroups[id]}
                  onRoleChange={(roleId) => {
                    setProjectsError(null)
                    setProjectRoles((prev) => ({ ...prev, [id]: roleId }))
                  }}
                  onGroupChange={(groupId) =>
                    setProjectGroups((prev) => ({ ...prev, [id]: groupId }))
                  }
                />
              ))}
            </div>
          )}
          {projectsError && (
            <p role="alert" className="text-error-500 text-sm">
              {projectsError}
            </p>
          )}
        </div>

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
