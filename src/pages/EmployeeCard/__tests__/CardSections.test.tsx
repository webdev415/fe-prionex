import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { CardSections } from '../components/CardSections'

function card(overrides: Partial<EmployeeCard> = {}): EmployeeCard {
  return {
    header: {
      id: 7,
      full_name: 'Kovalchuk Olena',
      last_name: 'Kovalchuk',
      first_name: 'Olena',
      middle_name: null,
      status: 'active',
      work_format: 'remote',
      avatar_url: null,
      phone: '+380 67 123 45 67',
      email: 'olena@prionex.com',
      position: 'Senior Operator',
      department: 'Collection Department',
      manager: 'Serhiy Lytvyn',
      manager_user_id: 9,
      hired_at: '2024-03-15',
      telegram: '@olena',
    },
    personal: {
      date_of_birth: '1994-05-12',
      telegram: '@olena',
      city: 'Kyiv',
      address: '22 Khreshchatyk St.',
      nova_poshta_branch: 'Branch No. 5, Kyiv',
      referral_source: 'Referral - Andrii Melnyk',
    },
    work: {
      project_id: 3,
      project_name: 'Technofinance',
      department: 'Collection Department',
      department_id: 1,
      position: 'Senior Operator',
      role_id: 2,
      manager: 'Serhiy Lytvyn',
      hired_at: '2024-03-15',
    },
    contacts: [],
    children: [],
    additional: { military_status: null, visa_status: null, educations: [], languages: [] },
    documents: [],
    surveys: [],
    interview_comment: null,
    can_edit: false,
    ...overrides,
  }
}

describe('CardSections', () => {
  it('shows the personal details the design asks for', () => {
    render(<CardSections card={card()} />)

    expect(screen.getByText('Branch No. 5, Kyiv')).toBeInTheDocument()
    expect(screen.getByText('Referral - Andrii Melnyk')).toBeInTheDocument()
    expect(screen.getByText('22 Khreshchatyk St.')).toBeInTheDocument()
  })

  it('lists a contact person and a child separately', () => {
    render(
      <CardSections
        card={card({
          contacts: [
            {
              id: 1,
              kind: 'contact',
              full_name: 'Kovalenko Serhiy',
              relation: 'Father',
              phone: '+380 50 987 6543',
              date_of_birth: null,
            },
          ],
          children: [
            {
              id: 2,
              kind: 'child',
              full_name: 'Kovalenko Mariya',
              relation: null,
              phone: null,
              date_of_birth: '2020-09-03',
            },
          ],
        })}
      />
    )

    expect(screen.getByText('Kovalenko Serhiy')).toBeInTheDocument()
    expect(screen.getByText('Father')).toBeInTheDocument()
    expect(screen.getByText('Kovalenko Mariya')).toBeInTheDocument()
  })

  it('reads a list of languages as one line', () => {
    render(
      <CardSections
        card={card({
          additional: {
            military_status: 'Deferral (Childcare)',
            visa_status: null,
            educations: [],
            languages: [
              { id: 1, language: 'English', level: 'B2' },
              { id: 2, language: 'Polish', level: null },
            ],
          },
        })}
      />
    )

    expect(screen.getByText('English (B2), Polish')).toBeInTheDocument()
  })

  it('shows every education entry rather than only the first', () => {
    render(
      <CardSections
        card={card({
          additional: {
            military_status: null,
            visa_status: null,
            languages: [],
            educations: [
              {
                id: 1,
                level: 'Higher',
                institution: 'KNU',
                faculty: 'Economic',
                speciality: 'Finance',
                graduation_year: 2016,
              },
              {
                id: 2,
                level: 'Secondary',
                institution: 'School 5',
                faculty: null,
                speciality: null,
                graduation_year: 2010,
              },
            ],
          },
        })}
      />
    )

    expect(screen.getByText('KNU')).toBeInTheDocument()
    expect(screen.getByText('School 5')).toBeInTheDocument()
    expect(screen.getByText('Economic / Finance')).toBeInTheDocument()
  })

  it('keeps an empty field in place instead of collapsing the layout', () => {
    render(<CardSections card={card({ personal: { ...card().personal, city: null } })} />)

    const section = screen.getByRole('region', {
      name: 'pages.employeeCard.sections.personal-information',
    })
    expect(within(section).getByText('pages.employeeCard.fields.city')).toBeInTheDocument()
  })

  it('offers an edit action only to somebody who may use it', async () => {
    const onEdit = vi.fn()
    render(<CardSections card={card({ can_edit: true })} onEdit={onEdit} />)

    const section = screen.getByRole('region', {
      name: 'pages.employeeCard.sections.work-information',
    })
    await userEvent.click(within(section).getByRole('button', { name: 'pages.employeeCard.edit' }))

    expect(onEdit).toHaveBeenCalledWith('work')
  })

  it('shows no edit action when the reader may not edit', () => {
    render(<CardSections card={card({ can_edit: false })} onEdit={vi.fn()} />)

    expect(
      screen.queryByRole('button', { name: 'pages.employeeCard.edit' })
    ).not.toBeInTheDocument()
  })
})

/*
 * The heading and its action are ruled off from the fields below them. In the
 * sections that are mostly "Not filled in" - which is most of them on a fresh
 * employee - nothing else marks where one section's heading ends and its
 * contents begin.
 */
describe('CardSections: the section headings', () => {
  /*
   * The monogram keeps the app's own ordering so the same person is not
   * "CJ" in the list and "JC" here; only the text the card prints changes.
   */
  it('prints the given name first, and only on the card', () => {
    render(<CardSections card={card()} />)

    expect(screen.getByText('Olena Kovalchuk')).toBeInTheDocument()
    expect(screen.queryByText('Kovalchuk Olena')).toBeNull()
  })

  it('rules the heading off from the fields under it', () => {
    render(<CardSections card={card()} />)

    const heading = screen.getByRole('heading', {
      name: 'pages.employeeCard.sections.personal-information',
    })
    expect(heading.parentElement?.className).toContain('border-b')
  })

  it('edits with a pencil rather than a word', () => {
    render(<CardSections card={card({ can_edit: true })} onEdit={vi.fn()} />)

    const edit = screen.getAllByRole('button', { name: 'pages.employeeCard.edit' })[0]
    expect(edit.querySelector('svg')).not.toBeNull()
    expect(edit).toHaveTextContent('')
  })

  /*
   * A link, not a button: the pencil sits in the heading row and should read
   * as part of it, so it carries no fill of its own and grows no chip on
   * hover - only its colour changes.
   */
  it('wears no button chrome', () => {
    render(<CardSections card={card({ can_edit: true })} onEdit={vi.fn()} />)

    const edit = screen.getAllByRole('button', { name: 'pages.employeeCard.edit' })[0]
    expect(edit.className).not.toMatch(/\bbg-/)
    expect(edit.className).not.toMatch(/\bborder\b/)
    expect(edit.className).toContain('hover:text-')
  })

  /*
   * A pencil on its own says nothing about which section it edits, so the
   * label has to be spoken even though it is no longer shown.
   */
  it('still says what it edits, for a reader who cannot see the pencil', () => {
    render(<CardSections card={card({ can_edit: true })} onEdit={vi.fn()} />)

    const edit = screen.getAllByRole('button', { name: 'pages.employeeCard.edit' })[0]
    expect(edit).toHaveAttribute('aria-label', 'pages.employeeCard.edit')
  })
})
