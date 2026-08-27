import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const saved = vi.hoisted(() => ({
  personal: vi.fn(),
  contacts: vi.fn(),
  additional: vi.fn(),
  rejectWith: null as unknown,
}))

function mutation(spy: (changes: unknown) => void) {
  return {
    mutateAsync: async (changes: unknown) => {
      if (saved.rejectWith) throw saved.rejectWith
      spy(changes)
      return {} as EmployeeCard
    },
    isPending: false,
  }
}

vi.mock('@/features/employeeCard/hooks/useEmployeeCard', () => ({
  useUpdatePersonal: () => mutation(saved.personal),
  useReplaceContacts: () => mutation(saved.contacts),
  useUpdateAdditional: () => mutation(saved.additional),
}))

const { PersonalDialog } = await import('../components/dialogs/PersonalDialog')
const { ContactsDialog } = await import('../components/dialogs/ContactsDialog')
const { AdditionalDialog } = await import('../components/dialogs/AdditionalDialog')

function card(overrides: Partial<EmployeeCard> = {}): EmployeeCard {
  return {
    header: {
      id: 7,
      full_name: 'Olena Kovalchuk',
      status: 'active',
      work_format: null,
      avatar_url: null,
      phone: null,
      email: null,
      position: null,
      department: null,
      manager: null,
      manager_user_id: null,
      hired_at: null,
      telegram: null,
    },
    personal: {
      date_of_birth: '1994-05-12',
      gender: null,
      citizenship: null,
      telegram: '@olena',
      city: 'Kyiv',
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
      tax_id: null,
      passport: null,
    },
    work: {
      project_id: null,
      project_name: null,
      department: null,
      department_id: null,
      position: null,
      role_id: null,
      manager: null,
      hired_at: null,
    },
    contacts: [],
    children: [],
    additional: { military_status: null, visa_status: null, educations: [], languages: [] },
    documents: [],
    surveys: [],
    interview_comment: null,
    can_edit: true,
    ...overrides,
  }
}

describe('PersonalDialog', () => {
  beforeEach(() => {
    saved.personal.mockReset()
    saved.rejectWith = null
  })

  it('opens with what the card already holds', () => {
    render(<PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    expect(screen.getByLabelText('pages.employeeCard.fields.city')).toHaveValue('Kyiv')
  })

  it('sends a cleared field as empty rather than leaving it out', async () => {
    render(<PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    await userEvent.clear(screen.getByLabelText('pages.employeeCard.fields.city'))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.personal).toHaveBeenCalledWith(
      expect.objectContaining({ city: null, telegram: '@olena' })
    )
  })

  it('offers the identity documents the design asks for', () => {
    render(<PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    expect(screen.getByLabelText('pages.employeeCard.fields.taxId')).toBeInTheDocument()
    expect(screen.getByLabelText('pages.employeeCard.fields.passport')).toBeInTheDocument()
  })

  it('keeps the dialog open and says why when the server refuses', async () => {
    const onClose = vi.fn()
    saved.rejectWith = {
      response: { data: { detail: 'Encryption keys are not configured' } },
    }
    render(<PersonalDialog card={card()} projectId={null} open onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Encryption keys are not configured')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes once the save has gone through', async () => {
    const onClose = vi.fn()
    render(<PersonalDialog card={card()} projectId={null} open onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(onClose).toHaveBeenCalled()
  })
})

describe('ContactsDialog', () => {
  beforeEach(() => {
    saved.contacts.mockReset()
    saved.rejectWith = null
  })

  it('sends the whole set, so a removed row is removed', async () => {
    render(
      <ContactsDialog
        card={card({
          contacts: [
            {
              id: 1,
              kind: 'contact',
              full_name: 'Kovalenko Serhiy',
              relation: 'Father',
              phone: null,
              date_of_birth: null,
            },
          ],
        })}
        projectId={null}
        open
        onClose={vi.fn()}
      />
    )

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.contacts).toHaveBeenCalledWith([])
  })

  it('adds a contact and a child separately', async () => {
    render(<ContactsDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    const [addContact, addChild] = screen.getAllByRole('button', {
      name: 'pages.employeeCard.dialogs.add',
    })
    await userEvent.click(addContact)
    await userEvent.type(
      screen.getByLabelText('pages.employeeCard.fields.name'),
      'Kovalenko Serhiy'
    )
    await userEvent.click(addChild)
    await userEvent.type(
      screen.getByLabelText('pages.employeeCard.fields.childName'),
      'Kovalenko Mariya'
    )
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.contacts).toHaveBeenCalledWith([
      expect.objectContaining({ kind: 'contact', full_name: 'Kovalenko Serhiy' }),
      expect.objectContaining({ kind: 'child', full_name: 'Kovalenko Mariya' }),
    ])
  })

  it('drops a row somebody added and then left blank', async () => {
    render(<ContactsDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    await userEvent.click(
      screen.getAllByRole('button', { name: 'pages.employeeCard.dialogs.add' })[0]
    )
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.contacts).toHaveBeenCalledWith([])
  })
})

describe('AdditionalDialog', () => {
  beforeEach(() => {
    saved.additional.mockReset()
    saved.rejectWith = null
  })

  it('opens with the languages written the way the card shows them', () => {
    render(
      <AdditionalDialog
        card={card({
          additional: {
            military_status: null,
            visa_status: null,
            educations: [],
            languages: [
              { id: 1, language: 'English', level: 'B2' },
              { id: 2, language: 'Polish', level: 'A2' },
            ],
          },
        })}
        projectId={null}
        open
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText('pages.employeeCard.fields.languages')).toHaveValue(
      'English (B2), Polish (A2)'
    )
  })

  it('sends education as the list the dialog ended up with', async () => {
    render(<AdditionalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'pages.employeeCard.dialogs.add' }))
    await userEvent.type(screen.getByLabelText('pages.employeeCard.fields.institution'), 'KNU')
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.additional).toHaveBeenCalledWith(
      expect.objectContaining({
        educations: [expect.objectContaining({ institution: 'KNU' })],
      })
    )
  })

  it('reads the language line back into rows on the way out', async () => {
    render(<AdditionalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    await userEvent.type(
      screen.getByLabelText('pages.employeeCard.fields.languages'),
      'English (B2), Polish'
    )
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.additional).toHaveBeenCalledWith(
      expect.objectContaining({
        languages: [
          { language: 'English', level: 'B2' },
          { language: 'Polish', level: null },
        ],
      })
    )
  })
})
