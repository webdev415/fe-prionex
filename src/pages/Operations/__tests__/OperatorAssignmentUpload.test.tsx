import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('@/features/imports/hooks/useOperatorAssignment', () => ({
  useDownloadOATemplate: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

import { OperatorAssignmentUpload } from '../components/OperatorAssignmentUpload'

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

describe('OperatorAssignmentUpload', () => {
  const mockOnFileSelected = vi.fn()

  const defaultProps = {
    onFileSelected: mockOnFileSelected,
    isUploading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render upload area', () => {
    render(<OperatorAssignmentUpload {...defaultProps} />, { wrapper: createWrapper() })

    // Should have file input
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('should accept only CSV files', () => {
    render(<OperatorAssignmentUpload {...defaultProps} />, { wrapper: createWrapper() })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput?.accept).toContain('.csv')
  })

  it('should call onFileSelected when CSV file is uploaded', async () => {
    const user = userEvent.setup()
    render(<OperatorAssignmentUpload {...defaultProps} />, { wrapper: createWrapper() })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['client_id,operator_id\n1,2'], 'test.csv', { type: 'text/csv' })

    await user.upload(fileInput, file)

    expect(mockOnFileSelected).toHaveBeenCalledWith(file)
  })

  it('should show download template button', () => {
    render(<OperatorAssignmentUpload {...defaultProps} />, { wrapper: createWrapper() })

    // Look for template download element
    const templateButton = screen.queryByText(/template/i)
    expect(templateButton).toBeInTheDocument()
  })
})
