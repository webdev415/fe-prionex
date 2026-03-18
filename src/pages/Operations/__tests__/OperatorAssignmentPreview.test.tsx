import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { OAPreviewResponse } from '@/features/imports/types/operatorAssignment'
import { OperatorAssignmentPreview } from '../components/OperatorAssignmentPreview'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

const mockPreview: OAPreviewResponse = {
  job_id: 1,
  batch_id: 'OA-2026-03-12-batch-01',
  filename: 'march-redistribution.csv',
  status: 'validated',
  total_records: 10,
  summary: { ready: 7, no_change: 1, invalid: 2, unique_operators: 3 },
  preview_rows: [
    {
      row_number: 1,
      client_id: 1001,
      client_name: 'John Doe',
      operator_id: 45,
      operator_name: 'Alice',
      current_operator_id: 12,
      current_operator_name: 'Bob',
      status: 'ready',
      error: null,
      severity: null,
    },
    {
      row_number: 2,
      client_id: 1002,
      client_name: 'Jane Smith',
      operator_id: 45,
      operator_name: 'Alice',
      current_operator_id: 45,
      current_operator_name: 'Alice',
      status: 'no_change',
      error: null,
      severity: null,
    },
  ],
  errors: [
    {
      row_number: 5,
      client_id: 9999,
      client_name: null,
      operator_id: 45,
      operator_name: 'Alice',
      current_operator_id: null,
      current_operator_name: null,
      status: 'error',
      error: 'Client not found',
      severity: 'error',
    },
  ],
}

describe('OperatorAssignmentPreview', () => {
  const mockOnConfirm = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    preview: mockPreview,
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    isExecuting: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render preview with summary cards', () => {
    render(<OperatorAssignmentPreview {...defaultProps} />, { wrapper: createWrapper() })

    // Summary values (some may appear in both summary cards and table rows)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('should render filename', () => {
    render(<OperatorAssignmentPreview {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByText('march-redistribution.csv')).toBeInTheDocument()
  })

  it('should render preview rows in table', () => {
    render(<OperatorAssignmentPreview {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('should render error rows', () => {
    render(<OperatorAssignmentPreview {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByText('Client not found')).toBeInTheDocument()
  })

  it('should call onConfirm with reason when confirm button is clicked', async () => {
    const user = userEvent.setup()
    render(<OperatorAssignmentPreview {...defaultProps} />, { wrapper: createWrapper() })

    // Type a reason
    const reasonInput = screen.getByPlaceholderText(/assignmentReasonPlaceholder/i)
    await user.type(reasonInput, 'March redistribution')

    // Click confirm
    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    expect(mockOnConfirm).toHaveBeenCalledWith('March redistribution')
  })

  it('should call onConfirm without reason when reason is empty', async () => {
    const user = userEvent.setup()
    render(<OperatorAssignmentPreview {...defaultProps} />, { wrapper: createWrapper() })

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    expect(mockOnConfirm).toHaveBeenCalledWith(undefined)
  })

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<OperatorAssignmentPreview {...defaultProps} />, { wrapper: createWrapper() })

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should disable confirm button when ready count is 0', () => {
    const emptyPreview = {
      ...mockPreview,
      summary: { ready: 0, no_change: 0, invalid: 10, unique_operators: 0 },
    }
    render(<OperatorAssignmentPreview {...defaultProps} preview={emptyPreview} />, {
      wrapper: createWrapper(),
    })

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    expect(confirmButton).toBeDisabled()
  })

  it('should disable buttons when isExecuting is true', () => {
    render(<OperatorAssignmentPreview {...defaultProps} isExecuting={true} />, {
      wrapper: createWrapper(),
    })

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    expect(cancelButton).toBeDisabled()
  })

  it('should render assignment reason input', () => {
    render(<OperatorAssignmentPreview {...defaultProps} />, { wrapper: createWrapper() })

    expect(screen.getByPlaceholderText(/assignmentReasonPlaceholder/i)).toBeInTheDocument()
  })
})
