import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

const downloadDocument = vi.hoisted(() => vi.fn())

vi.mock('@/features/employeeCard/api/employeeCardApi', () => ({ downloadDocument }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const { DocumentsSection } = await import('../components/DocumentsSection')
const { SurveysSection } = await import('../components/SurveysSection')

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
      email: null,
      position: null,
      department: null,
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
    can_edit: false,
    ...overrides,
  }
}

const CV = {
  id: 11,
  kind: 'cv',
  original_filename: 'CV_Kovalenko_Olena.pdf',
  content_type: 'application/pdf',
  size_bytes: 251_000,
  uploaded_at: '2024-03-10T00:00:00Z',
}

describe('DocumentsSection', () => {
  beforeEach(() => {
    downloadDocument.mockReset()
    downloadDocument.mockResolvedValue(new Blob(['x']))
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:x'), writable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true })
  })

  it('describes the file it holds', () => {
    render(<DocumentsSection card={card({ documents: [CV] })} />)

    expect(screen.getByText('CV_Kovalenko_Olena.pdf')).toBeInTheDocument()
  })

  it('fetches through the API rather than linking straight at the route', async () => {
    render(<DocumentsSection card={card({ documents: [CV] })} />)

    await userEvent.click(
      screen.getByRole('button', { name: 'pages.employeeCard.documents.download' })
    )

    expect(downloadDocument).toHaveBeenCalledWith(7, 11)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('says so when there is nothing attached', () => {
    render(<DocumentsSection card={card()} />)

    expect(screen.getByText('pages.employeeCard.documents.none')).toBeInTheDocument()
  })

  it('shows the interview comment beside the files', () => {
    render(<DocumentsSection card={card({ interview_comment: 'Confident, communicative.' })} />)

    expect(screen.getByText('Confident, communicative.')).toBeInTheDocument()
  })
})

describe('SurveysSection', () => {
  it('shows a completed answer with its score', () => {
    render(
      <SurveysSection
        card={card({
          surveys: [
            {
              id: 1,
              name: 'Q2 2024 Satisfaction Survey',
              completed_on: '2024-06-15',
              status: 'completed',
              score: 87,
              max_score: 100,
              details_url: null,
            },
          ],
        })}
      />
    )

    expect(screen.getByText('87/100')).toBeInTheDocument()
  })

  it('shows one still being waited on as pending rather than as zero', () => {
    render(
      <SurveysSection
        card={card({
          surveys: [
            {
              id: 2,
              name: 'Manager Evaluation Q3 2024',
              completed_on: null,
              status: 'pending',
              score: null,
              max_score: null,
              details_url: null,
            },
          ],
        })}
      />
    )

    expect(screen.getByText('pages.employeeCard.surveys.pending')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('offers the link to the details when the import carried one', () => {
    render(
      <SurveysSection
        card={card({
          surveys: [
            {
              id: 3,
              name: 'Onboarding Feedback',
              completed_on: '2024-03-22',
              status: 'completed',
              score: 92,
              max_score: 100,
              details_url: 'https://forms.example/response/3',
            },
          ],
        })}
      />
    )

    const link = screen.getByRole('link', { name: 'pages.employeeCard.surveys.details' })
    expect(link).toHaveAttribute('href', 'https://forms.example/response/3')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('shows no link for an answer that came without one', () => {
    render(
      <SurveysSection
        card={card({
          surveys: [
            {
              id: 4,
              name: 'Q2 2024 Satisfaction Survey',
              completed_on: '2024-06-15',
              status: 'completed',
              score: 87,
              max_score: 100,
              details_url: null,
            },
          ],
        })}
      />
    )

    // Queried by text, not by role: an anchor with no href has no link role,
    // so a role query would pass even with the anchor rendered.
    expect(screen.queryByText('pages.employeeCard.surveys.details')).not.toBeInTheDocument()
  })

  it('says so when no surveys have been recorded', () => {
    render(<SurveysSection card={card()} />)

    expect(screen.getByText('pages.employeeCard.surveys.none')).toBeInTheDocument()
  })
})
