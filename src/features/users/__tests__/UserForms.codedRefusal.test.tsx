/**
 * A refused save of a user reads as the sentence from errors.json in both user
 * modals (KAN-1476, DESIGN §8).
 *
 * The HUB-admin assignment guard (HUB_ADMIN_ASSIGNMENT_REQUIRES_HUB_ADMIN,
 * DESIGN §5.2 guard 3) and the project scope of assignments
 * (PROJECT_SCOPE_DENIED, CRM-3) refuse mostly here: create_user and
 * update_user are the paths that put a person on a role. The toast of the
 * mutation hook was already translated; the alert inside the form showed
 * axios' own "Request failed with status code 403" - the form read
 * `error.message` instead of the server's answer.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/lib/i18n'
import ukErrors from '@/../public/locales/uk/errors.json'
import type { UserDetailResponse } from '../types'

const state = vi.hoisted(() => ({
  error: null as unknown,
}))

vi.mock('../hooks/useCreateUser', () => ({
  useCreateUser: () => ({ mutate: vi.fn(), isError: state.error !== null, error: state.error }),
}))

vi.mock('../hooks/useUpdateUser', () => ({
  useUpdateUser: () => ({ mutate: vi.fn(), isError: state.error !== null, error: state.error }),
}))

vi.mock('@/features/projects', () => ({
  useProjects: () => ({ data: { projects: [] }, isLoading: false }),
}))

const { CreateUserForm } = await import('../components/CreateUserForm')
const { EditUserForm } = await import('../components/EditUserForm')

type Codes = { codes: Record<string, string> }

const TRANSPORT_TEXT = 'Request failed with status code 403'

function speakUkrainianErrors() {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
    options?.ns === 'errors' && key.startsWith('codes.')
      ? ((ukErrors as Codes).codes[key.slice('codes.'.length)] ?? options.defaultValue)
      : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)
}

function forbidden(code: string, detail: string) {
  return Object.assign(new Error(TRANSPORT_TEXT), {
    isAxiosError: true,
    response: { status: 403, data: { detail, code } },
  })
}

const user = {
  id: 42,
  username: 'olena',
  email: 'olena@example.com',
  first_name: 'Олена',
  last_name: 'Коваль',
  middle_name: '',
  phone: '+380-501112233',
  language: 'uk',
  timezone: 'Europe/Kyiv',
  asterisk_extension: null,
  dialer_extension: null,
  is_agent: false,
  status: 'active',
  projects: [],
} as unknown as UserDetailResponse

const FORMS = [
  ['creating', () => <CreateUserForm projects={[]} onSuccess={vi.fn()} />],
  ['editing', () => <EditUserForm user={user} onSuccess={vi.fn()} />],
] as const

const REFUSALS = [
  [
    'HUB_ADMIN_ASSIGNMENT_REQUIRES_HUB_ADMIN',
    'Only a HUB admin of this project may assign this role',
  ],
  ['PROJECT_SCOPE_DENIED', 'No edit_users in project 2'],
] as const

afterEach(() => {
  vi.restoreAllMocks()
  state.error = null
})

describe('User forms - a coded refusal of the save', () => {
  describe.each(FORMS)('while %s a user', (_form, renderForm) => {
    it.each(REFUSALS)('shows %s in the words of errors.json', (code, english) => {
      const sentence = (ukErrors as Codes).codes[code]
      // Without its sentence the assertion below would compare against nothing.
      expect(sentence).toBeTruthy()
      speakUkrainianErrors()
      state.error = forbidden(code, english)

      render(renderForm())

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(sentence)
      expect(alert).not.toHaveTextContent(TRANSPORT_TEXT)
    })
  })
})
