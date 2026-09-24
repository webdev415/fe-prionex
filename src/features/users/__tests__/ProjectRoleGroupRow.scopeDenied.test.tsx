/**
 * A project whose roles the caller may not list (PROJECT_SCOPE_DENIED once the
 * CRM project scope is enforced) says so, instead of looking like a project
 * without roles (KAN-1476).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/lib/i18n'
import ukErrors from '@/../public/locales/uk/errors.json'

const state = vi.hoisted(() => ({
  roles: { data: undefined as unknown, error: null as unknown },
}))

vi.mock('@/features/roles', () => ({
  useProjectRoles: () => state.roles,
}))

vi.mock('@/features/groups', () => ({
  useGroups: () => ({ data: undefined }),
}))

const { ProjectRoleGroupRow } = await import('../components/ProjectRoleGroupRow')

const DENIED = (ukErrors as { codes: Record<string, string> }).codes.PROJECT_SCOPE_DENIED

function speakUkrainianErrors() {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
    options?.ns === 'errors' && key.startsWith('codes.')
      ? ((ukErrors as { codes: Record<string, string> }).codes[key.slice(6)] ??
        options.defaultValue)
      : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)
}

afterEach(() => {
  vi.restoreAllMocks()
  state.roles = { data: undefined, error: null }
})

function forbidden(data: Record<string, unknown>) {
  return Object.assign(new Error('Request failed with status code 403'), {
    isAxiosError: true,
    response: { status: 403, data },
  })
}

const scopeDenied = () =>
  forbidden({ detail: 'No manage_roles in project 2', code: 'PROJECT_SCOPE_DENIED' })

function renderRow() {
  return render(
    <ProjectRoleGroupRow
      projectId={2}
      projectName="Spain Test Project"
      selectedRoleId={undefined}
      selectedGroupId={undefined}
      onRoleChange={vi.fn()}
      onGroupChange={vi.fn()}
    />
  )
}

describe('ProjectRoleGroupRow', () => {
  it('says why the roles of a project cannot be offered', () => {
    speakUkrainianErrors()
    state.roles = { data: undefined, error: scopeDenied() }

    renderRow()

    expect(DENIED).toBeTruthy()
    expect(screen.getByRole('alert')).toHaveTextContent(DENIED)
  })

  /*
   * The reason is said once, beside the picker - not a second time as a fake
   * entry inside it - and the picker, with nothing in it to pick, is disabled
   * and points at the reason.
   */
  it('disables the refused picker and points it at the reason', () => {
    speakUkrainianErrors()
    state.roles = { data: undefined, error: scopeDenied() }

    renderRow()

    const alert = screen.getByRole('alert')
    const picker = screen.getByRole('combobox')
    expect(picker).toBeDisabled()
    expect(picker).toHaveAttribute('aria-describedby', alert.id)
    expect(screen.getAllByText(DENIED)).toHaveLength(1)
  })

  /*
   * Only the new, coded refusal of the project scope is explained. Any other
   * failure of the list (the permission check's uncoded 403, a 500) keeps the
   * row exactly as it was before KAN-1476: no alert, an open picker.
   *
   * The two are rendered side by side in one test, so it pins the difference
   * itself: it fails on the code before KAN-1476 (no refusal is told apart
   * there, the coded one included) and on a check widened to any error
   * (`isProjectScopeDenied` -> `error != null`), which explains the uncoded
   * 403 too.
   */
  it('explains the project-scope refusal and keeps any other failure as quiet as it was', () => {
    speakUkrainianErrors()
    state.roles = {
      data: undefined,
      error: forbidden({ detail: 'Permission denied: manage_roles required' }),
    }
    const { unmount } = renderRow()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeEnabled()
    unmount()

    state.roles = { data: undefined, error: scopeDenied() }
    renderRow()

    expect(screen.getByRole('alert')).toHaveTextContent(DENIED)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })
})
