import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

// Radix Select measures and scrolls on open, and jsdom implements neither.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

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
      last_name: 'Kovalchuk',
      first_name: 'Olena',
      middle_name: null,
      status: 'active',
      work_format: null,
      avatar_url: null,
      phone: null,
      email: 'olena.kovalchuk@prionex.com',
      position: null,
      department: null,
      manager: null,
      manager_user_id: null,
      hired_at: null,
      telegram: null,
    },
    personal: {
      date_of_birth: '1994-05-12',
      telegram: '@olena',
      city: 'Kyiv',
      address: null,
      nova_poshta_branch: null,
      referral_source: null,
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

  it('offers every field the section displays, so all of them can be changed', () => {
    render(<PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    for (const field of ['telegram', 'city', 'address', 'referralSource']) {
      expect(screen.getByLabelText(`pages.employeeCard.fields.${field}`)).toBeInTheDocument()
    }
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

/*
 * The section reads from two tables and the dialog has to write both, because
 * the section shows name, phone and email and nothing else in the app can
 * change them for somebody else any more - the employees list dropped its
 * Actions column and its edit modal went unreachable with it.
 */
describe('PersonalDialog: the fields that live on the employee record', () => {
  beforeEach(() => {
    saved.personal.mockReset()
    saved.rejectWith = null
  })

  const open = () =>
    render(<PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

  const field = (name: string) => screen.getByLabelText(`pages.employeeCard.fields.${name}`)

  it('opens with the name split the way it is stored', () => {
    open()

    expect(field('lastName')).toHaveValue('Kovalchuk')
    expect(field('firstName')).toHaveValue('Olena')
  })

  it('offers every field the section displays', () => {
    open()

    for (const name of ['lastName', 'firstName', 'middleName', 'phone', 'email', 'workFormat']) {
      expect(field(name)).toBeInTheDocument()
    }
  })

  it('sends a corrected name', async () => {
    open()

    await userEvent.clear(field('lastName'))
    await userEvent.type(field('lastName'), 'Kovalenko')
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.personal).toHaveBeenCalledWith(
      expect.objectContaining({ last_name: 'Kovalenko', first_name: 'Olena' })
    )
  })

  it('sends a phone and an address alongside the profile fields', async () => {
    open()

    await userEvent.type(field('phone'), '+380 67 123 45 67')
    await userEvent.clear(field('city'))
    await userEvent.type(field('city'), 'Lviv')
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.personal).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+380 67 123 45 67', city: 'Lviv' })
    )
  })

  /*
   * These columns are NOT NULL. Sending a null would be refused, so the form
   * refuses first - which is the difference between a message beside the field
   * and one at the top of the dialog after a round trip.
   */
  it('will not submit a name it has been asked to empty', async () => {
    open()

    await userEvent.clear(field('firstName'))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.personal).not.toHaveBeenCalled()
  })

  it('will not submit without an address', async () => {
    open()

    await userEvent.clear(field('email'))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.personal).not.toHaveBeenCalled()
  })

  it('always sends a work format rather than a null it cannot store', async () => {
    open()

    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.personal).toHaveBeenCalledWith(expect.objectContaining({ work_format: 'office' }))
  })
})

/*
 * Dates on the card are picked, not typed into a browser's own date box. The
 * native control renders in the browser's locale rather than the app's and
 * cannot be styled to match, so the card used to show mm/dd/yyyy to people
 * working in dd.MM.yyyy.
 */
describe('the card picks dates rather than using the browser box', () => {
  beforeEach(() => {
    saved.personal.mockReset()
    saved.contacts.mockReset()
    saved.rejectWith = null
  })

  it('offers no native date box in the personal dialog', () => {
    const { container } = render(
      <PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />
    )

    expect(container.querySelector('input[type="date"]')).toBeNull()
  })

  it('shows a stored date of birth the way it is written here', () => {
    render(<PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    expect(screen.getByPlaceholderText('pages.employeeCard.fields.dateOfBirth')).toHaveValue(
      '12.05.1994'
    )
  })

  it('stores what was picked as the day it is, not the day before', async () => {
    render(<PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    const picker = screen.getByPlaceholderText('pages.employeeCard.fields.dateOfBirth')
    await userEvent.clear(picker)
    await userEvent.type(picker, '03.09.2020')
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.personal).toHaveBeenCalledWith(
      expect.objectContaining({ date_of_birth: '2020-09-03' })
    )
  })

  it('sends no date at all once one is cleared', async () => {
    render(<PersonalDialog card={card()} projectId={null} open onClose={vi.fn()} />)

    await userEvent.clear(screen.getByPlaceholderText('pages.employeeCard.fields.dateOfBirth'))
    await userEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(saved.personal).toHaveBeenCalledWith(expect.objectContaining({ date_of_birth: null }))
  })

  it('offers no native date box for a child either', () => {
    const { container } = render(
      <ContactsDialog card={card()} projectId={null} open onClose={vi.fn()} />
    )

    expect(container.querySelector('input[type="date"]')).toBeNull()
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
