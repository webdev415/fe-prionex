/**
 * AiRubricsSection tests — reading the outbound line off the list.
 *
 * The API layer is mocked, the hooks are real. What matters here is that a
 * rubric answered without `telephony_type` (every rubric, until the backend
 * split ships) reads as «any line» rather than as a blank cell, and that the
 * line filter narrows on the same rule.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { toast } from 'sonner'

import { AiRubricsSection } from '../AiRubricsSection'
import { listQaTemplates, updateQaTemplate } from '../../../api/qaRulesService'
import type { ScorecardTemplate } from '../../../types'

vi.mock('../../../api/qaRulesService', () => ({
  listQaTemplates: vi.fn(),
  createQaTemplate: vi.fn(),
  updateQaTemplate: vi.fn(),
  archiveQaTemplate: vi.fn(),
  unarchiveQaTemplate: vi.fn(),
  listQaBlockers: vi.fn(),
  createQaBlocker: vi.fn(),
  updateQaBlocker: vi.fn(),
  deleteQaBlocker: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/features/departments', () => ({
  useDepartments: () => ({ data: { departments: [{ id: 5, name: 'Стягнення' }] } }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

const mockList = vi.mocked(listQaTemplates)
const mockUpdate = vi.mocked(updateQaTemplate)

function rubric(overrides: Partial<ScorecardTemplate> = {}): ScorecardTemplate {
  return {
    id: 1,
    project_id: 1,
    name: 'Універсальна',
    description: null,
    call_type: null,
    purpose: 'ai',
    department_id: null,
    scorecard_type: 'client',
    sections: [
      {
        key: 'script',
        name: 'Скрипт',
        criteria: [{ key: 'c0', name: 'K', scale: '0-5', weight: 100 }],
      },
    ],
    is_archived: false,
    created_by: 1,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AiRubricsSection />
    </QueryClientProvider>
  )
}

const lineFilter = () => screen.getByLabelText('pages.qaRules.rubrics.telephonyType')

describe('AiRubricsSection — the outbound line column', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads a rubric answered without the field as «any line»', async () => {
    mockList.mockResolvedValue([rubric()])
    renderSection()
    await waitFor(() =>
      expect(screen.getByTestId('rubric-row-telephony-1')).toHaveTextContent(
        'pages.qaRules.rubrics.telephonyAny'
      )
    )
  })

  it('names the line a pinned rubric carries', async () => {
    mockList.mockResolvedValue([rubric({ id: 2, telephony_type: 'grey' })])
    renderSection()
    await waitFor(() =>
      expect(screen.getByTestId('rubric-row-telephony-2')).toHaveTextContent(
        'pages.qaRules.rubrics.telephony.grey'
      )
    )
  })

  it('narrows the list to one line, and «any» to the unpinned rubrics only', async () => {
    mockList.mockResolvedValue([
      rubric({ id: 1, name: 'Універсальна' }),
      rubric({ id: 2, name: 'Біла', telephony_type: 'white' }),
      rubric({ id: 3, name: 'Сіра', telephony_type: 'grey' }),
    ])
    renderSection()
    await waitFor(() => expect(screen.getByText('Сіра')).toBeInTheDocument())

    fireEvent.change(lineFilter(), { target: { value: 'grey' } })
    expect(screen.getByText('Сіра')).toBeInTheDocument()
    expect(screen.queryByText('Біла')).not.toBeInTheDocument()
    expect(screen.queryByText('Універсальна')).not.toBeInTheDocument()

    fireEvent.change(lineFilter(), { target: { value: 'any' } })
    expect(screen.getByText('Універсальна')).toBeInTheDocument()
    expect(screen.queryByText('Сіра')).not.toBeInTheDocument()

    fireEvent.change(lineFilter(), { target: { value: 'all' } })
    expect(screen.getByText('Універсальна')).toBeInTheDocument()
    expect(screen.getByText('Сіра')).toBeInTheDocument()
  })
})

describe('AiRubricsSection — saving the line', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carries telephony_type through the PUT', async () => {
    // The update payload is assembled field by field (purpose is immutable
    // and deliberately left out). A field forgotten there is silently
    // dropped: the trainer picks «Сіра», saves, and the select snaps back.
    const target = rubric({ id: 4, telephony_type: 'white' })
    mockList.mockResolvedValue([target])
    mockUpdate.mockResolvedValue({ ...target, telephony_type: 'grey' })
    renderSection()

    await waitFor(() => expect(screen.getByText('actions.edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('actions.edit'))
    // Scoped to the editor: the list's line filter answers the same label.
    const editor = within(screen.getByTestId('ai-rubric-editor'))
    fireEvent.change(editor.getByLabelText('pages.qaRules.rubrics.telephonyType'), {
      target: { value: 'grey' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(mockUpdate.mock.calls[0][1].telephony_type).toBe('grey')
  })

  it('omits the key when the trainer never touched the line', async () => {
    // «Key absent» and «null» mean different things to the update route:
    // absent leaves the line alone, null clears it. Spelling the key out on
    // every save would unpin a rubric on an unrelated weight edit.
    const target = rubric({ id: 5, telephony_type: 'grey' })
    mockList.mockResolvedValue([target])
    mockUpdate.mockResolvedValue(target)
    renderSection()

    await waitFor(() => expect(screen.getByText('actions.edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('actions.edit'))
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty('telephony_type')
  })
})

function validationError(detail: unknown): AxiosError {
  const error = new AxiosError('unprocessable')
  error.response = {
    status: 422,
    statusText: 'Unprocessable Entity',
    data: { detail },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return error
}

describe('AiRubricsSection — relaying a refusal the editor did not catch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function saveAndFail(detail: unknown) {
    const target = rubric({ id: 7 })
    mockList.mockResolvedValue([target])
    mockUpdate.mockRejectedValue(validationError(detail))
    renderSection()
    await waitFor(() => expect(screen.getByText('actions.edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('actions.edit'))
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  }

  it("flattens FastAPI's list of validation messages instead of dropping them", async () => {
    // 422 carries `[{loc, msg, type}]`, not a string — a reader that only
    // takes strings shows «could not save» and hides the actual rule.
    await saveAndFail([
      { loc: ['body', 'grading_rules'], msg: 'scale would never apply', type: 'value_error' },
    ])
    expect(toast.error).toHaveBeenCalledWith('scale would never apply')
  })

  it('relays a plain-string detail as it stands', async () => {
    await saveAndFail('duplicate score in grading scale')
    expect(toast.error).toHaveBeenCalledWith('duplicate score in grading scale')
  })

  it('falls back to the generic message when the refusal explains nothing', async () => {
    await saveAndFail(undefined)
    expect(toast.error).toHaveBeenCalledWith('pages.qaRules.saveError')
  })
})
