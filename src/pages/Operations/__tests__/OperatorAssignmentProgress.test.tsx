import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

const mockCancelMutate = vi.fn()
const mockExportMutate = vi.fn()

vi.mock('@/features/imports/hooks/useImportMutations', () => ({
  useCancelImport: () => ({
    mutate: mockCancelMutate,
    isPending: false,
  }),
  useExportImportErrors: () => ({
    mutate: mockExportMutate,
    isPending: false,
  }),
}))

vi.mock('@/features/imports/api/importsApi', () => ({
  importsApi: {
    getImportJobDetail: vi.fn(),
  },
}))

import { importsApi } from '@/features/imports/api/importsApi'
import { OperatorAssignmentProgress } from '../components/OperatorAssignmentProgress'

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

describe('OperatorAssignmentProgress', () => {
  const mockOnComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show spinner while loading', () => {
    vi.mocked(importsApi.getImportJobDetail).mockReturnValue(new Promise(() => {}))

    render(<OperatorAssignmentProgress jobId={1} onComplete={mockOnComplete} />, {
      wrapper: createWrapper(),
    })

    // Should show loading state (spinner)
    expect(document.querySelector('.h-8.w-8')).toBeInTheDocument()
  })

  it('should show completed state with stats', async () => {
    vi.mocked(importsApi.getImportJobDetail).mockResolvedValue({
      id: 1,
      file_name: 'test.csv',
      uploaded_by: 'admin',
      uploaded_at: '2026-03-12T00:00:00Z',
      status: 'completed',
      total_rows: 100,
      new_clients: 90,
      updated_clients: 0,
      errors_count: 10,
      processing_time: '5 s',
      import_type: 'operator_assignment',
    })

    render(<OperatorAssignmentProgress jobId={1} onComplete={mockOnComplete} />, {
      wrapper: createWrapper(),
    })

    // Wait for data to load
    const completeText = await screen.findByText(/complete/i)
    expect(completeText).toBeInTheDocument()

    // Stats should show
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('should show download errors button when there are errors', async () => {
    vi.mocked(importsApi.getImportJobDetail).mockResolvedValue({
      id: 1,
      file_name: 'test.csv',
      uploaded_by: 'admin',
      uploaded_at: '2026-03-12T00:00:00Z',
      status: 'completed',
      total_rows: 100,
      new_clients: 90,
      updated_clients: 0,
      errors_count: 10,
      processing_time: '5 s',
      import_type: 'operator_assignment',
    })

    render(<OperatorAssignmentProgress jobId={1} onComplete={mockOnComplete} />, {
      wrapper: createWrapper(),
    })

    const downloadBtn = await screen.findByText(/download/i)
    expect(downloadBtn).toBeInTheDocument()
  })

  it('should call onComplete when start new import is clicked', async () => {
    const user = userEvent.setup()

    vi.mocked(importsApi.getImportJobDetail).mockResolvedValue({
      id: 1,
      file_name: 'test.csv',
      uploaded_by: 'admin',
      uploaded_at: '2026-03-12T00:00:00Z',
      status: 'completed',
      total_rows: 100,
      new_clients: 100,
      updated_clients: 0,
      errors_count: 0,
      processing_time: '3 s',
      import_type: 'operator_assignment',
    })

    render(<OperatorAssignmentProgress jobId={1} onComplete={mockOnComplete} />, {
      wrapper: createWrapper(),
    })

    const newImportBtn = await screen.findByText(/startNewImport/i)
    await user.click(newImportBtn)

    expect(mockOnComplete).toHaveBeenCalled()
  })

  it('should show cancel button during active processing', async () => {
    vi.mocked(importsApi.getImportJobDetail).mockResolvedValue({
      id: 1,
      file_name: 'test.csv',
      uploaded_by: 'admin',
      uploaded_at: '2026-03-12T00:00:00Z',
      status: 'in_progress',
      total_rows: 100,
      new_clients: 50,
      updated_clients: 0,
      errors_count: 0,
      processing_time: '',
      import_type: 'operator_assignment',
      progress_percentage: 50,
    })

    render(<OperatorAssignmentProgress jobId={1} onComplete={mockOnComplete} />, {
      wrapper: createWrapper(),
    })

    const cancelBtn = await screen.findByText(/cancel/i)
    expect(cancelBtn).toBeInTheDocument()
  })

  it('should call cancel mutation when cancel is clicked', async () => {
    const user = userEvent.setup()

    vi.mocked(importsApi.getImportJobDetail).mockResolvedValue({
      id: 1,
      file_name: 'test.csv',
      uploaded_by: 'admin',
      uploaded_at: '2026-03-12T00:00:00Z',
      status: 'in_progress',
      total_rows: 100,
      new_clients: 50,
      updated_clients: 0,
      errors_count: 0,
      processing_time: '',
      import_type: 'operator_assignment',
      progress_percentage: 50,
    })

    render(<OperatorAssignmentProgress jobId={1} onComplete={mockOnComplete} />, {
      wrapper: createWrapper(),
    })

    const cancelBtn = await screen.findByText(/cancel/i)
    await user.click(cancelBtn)

    expect(mockCancelMutate).toHaveBeenCalledWith(1)
  })
})
