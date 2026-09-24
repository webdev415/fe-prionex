/**
 * The Personnel Data dialog under the HUB-admin assignment guard and the CRM
 * project scope of assignments (KAN-1476, DESIGN §5.2 guard 3 and §5.3): a
 * refused save reads as the sentence from errors.json, not as the server's
 * English.
 *
 * The dialog shows a refused save through `useSectionSave`, which reads the
 * response's `detail`; the shared axios client localizes a coded detail on the
 * way out (`localizeCodedDetail`). What makes these refusals readable is the
 * sentence for each new code in errors.json - absent before KAN-1476, when the
 * dialog showed the server's English detail here.
 *
 * Which positions the dialog offers is not this file's concern: the roles
 * hooks are stubbed, whichever of them the dialog asks.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/lib/i18n'
import ukErrors from '@/../public/locales/uk/errors.json'
import { localizeCodedDetail } from '@/lib/errors'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const state = vi.hoisted(() => ({
  rejectWith: null as unknown,
}))

vi.mock('@/features/employeeCard/hooks/useEmployeeCard', () => ({
  useUpdateWork: () => ({
    mutateAsync: async () => {
      if (state.rejectWith) throw state.rejectWith
      return {} as EmployeeCard
    },
    isPending: false,
  }),
}))

vi.mock('@/features/departments', () => ({
  useDepartments: () => ({ data: { departments: [{ id: 1, name: 'Collections' }] } }),
}))

vi.mock('@/features/roles', () => {
  const positions = {
    data: {
      roles: [
        { id: 10, project_id: 3, name: 'Operator', department_id: 1, is_active: true },
        { id: 13, project_id: 3, name: 'Admin', department_id: null, is_active: true },
      ],
    },
    error: null,
  }
  return { useRoles: () => positions, useProjectRoles: () => positions }
})

vi.mock('@/features/groups', () => ({
  useGroups: () => ({ data: { groups: [] } }),
}))

vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({ data: [] }),
}))

const { WorkDialog } = await import('../components/dialogs/WorkDialog')

type Codes = { codes: Record<string, string> }

function speakUkrainianErrors() {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
    options?.ns === 'errors' && key.startsWith('codes.')
      ? ((ukErrors as Codes).codes[key.slice('codes.'.length)] ?? options.defaultValue)
      : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)
}

function refusal(status: number, code: string, detail: string) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { detail, code } },
  })
}

function card(): EmployeeCard {
  return {
    header: {
      id: 7,
      full_name: 'Kovalchuk Olena',
      last_name: 'Kovalchuk',
      first_name: 'Olena',
      middle_name: null,
      status: 'active',
      work_format: null,
      avatar_url: null,
      phone: null,
      email: null,
      position: 'Operator',
      department: 'Collections',
      manager: null,
      manager_user_id: null,
      hired_at: null,
      telegram: null,
    },
    personal: {
      date_of_birth: null,
      telegram: null,
      city: null,
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
    },
    work: {
      project_id: 3,
      project_name: 'Technofinance',
      department: 'Collections',
      department_id: 1,
      group: null,
      group_id: null,
      position: 'Operator',
      role_id: 10,
      manager: null,
      hired_at: null,
      asterisk_extension: null,
      dialer_extension: null,
      is_agent: false,
    },
    contacts: [],
    children: [],
    additional: { military_status: null, visa_status: null, educations: [], languages: [] },
    documents: [],
    surveys: [],
    interview_comment: null,
    termination: null,
    can_edit: true,
  }
}

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  state.rejectWith = null
})

describe('WorkDialog - a refused save under the HUB-admin guard and the project scope', () => {
  it.each([
    [
      'a move to a HUB-admin role (guard 3)',
      'HUB_ADMIN_ASSIGNMENT_REQUIRES_HUB_ADMIN',
      'Only a HUB admin of this project may assign this role',
    ],
    [
      'a position in a project outside the caller scope (CRM-3)',
      'PROJECT_SCOPE_DENIED',
      'No edit_users in project 3',
    ],
  ])('reads %s in Ukrainian', async (_case, code, english) => {
    const sentence = (ukErrors as Codes).codes[code]
    // Without its sentence the assertion below would compare against nothing.
    expect(sentence).toBeTruthy()
    speakUkrainianErrors()
    // The shared axios client localizes a coded detail on the way out; this
    // is the object the dialog then receives.
    const error = refusal(403, code, english)
    localizeCodedDetail(error)
    state.rejectWith = error
    const onClose = vi.fn()
    render(<WorkDialog card={card()} projectId={3} open onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(sentence)
    expect(alert).not.toHaveTextContent(english)
    expect(onClose).not.toHaveBeenCalled()
  })
})
