import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('@/features/imports/hooks/useTagAssignment', () => ({
  useDownloadTagAssignmentTemplate: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}))

// Make `t(key, default)` and `t(key, { defaultValue, ... })` resolve to the
// default text so component assertions can match on user-visible English
// without depending on the http-backend loader.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultOrOpts?: unknown) => {
      if (typeof defaultOrOpts === 'string') return defaultOrOpts
      if (defaultOrOpts && typeof defaultOrOpts === 'object') {
        const opts = defaultOrOpts as { defaultValue?: string }
        return opts.defaultValue ?? key
      }
      return key
    },
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
}))

import { TagAssignmentUpload } from '../components/TagAssignmentUpload'
import type { TagAssignmentMode } from '@/features/imports/types/tagAssignment'

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

describe('TagAssignmentUpload', () => {
  const mockOnFileSelected = vi.fn()
  const mockOnModeChange = vi.fn()

  function defaultProps(
    overrides: Partial<{ mode: TagAssignmentMode; isUploading: boolean }> = {}
  ) {
    return {
      mode: 'assign' as TagAssignmentMode,
      onModeChange: mockOnModeChange,
      onFileSelected: mockOnFileSelected,
      isUploading: false,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upload area accepting CSV and XLSX', () => {
    render(<TagAssignmentUpload {...defaultProps()} />, { wrapper: createWrapper() })
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(fileInput).toBeInTheDocument()
    expect(fileInput?.accept).toContain('.csv')
    expect(fileInput?.accept).toContain('.xlsx')
  })

  it('shows both mode buttons and the assign-mode hint by default', () => {
    render(<TagAssignmentUpload {...defaultProps()} />, { wrapper: createWrapper() })
    expect(screen.getByRole('button', { name: /assign tags/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove tags/i })).toBeInTheDocument()
    expect(screen.getByText(/added to each client/i)).toBeInTheDocument()
  })

  it('shows the remove-mode hint when mode=remove', () => {
    render(<TagAssignmentUpload {...defaultProps({ mode: 'remove' })} />, {
      wrapper: createWrapper(),
    })
    expect(screen.getByText(/removed from each client/i)).toBeInTheDocument()
  })

  it('calls onModeChange when toggling between assign and remove', async () => {
    const user = userEvent.setup()
    render(<TagAssignmentUpload {...defaultProps()} />, { wrapper: createWrapper() })
    await user.click(screen.getByRole('button', { name: /remove tags/i }))
    expect(mockOnModeChange).toHaveBeenCalledWith('remove')
  })

  it('calls onFileSelected when a CSV is uploaded', async () => {
    const user = userEvent.setup()
    render(<TagAssignmentUpload {...defaultProps()} />, { wrapper: createWrapper() })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['tax_id,tags\n111,VIP'], 'test.csv', { type: 'text/csv' })
    await user.upload(fileInput, file)
    expect(mockOnFileSelected).toHaveBeenCalledWith(file)
  })

  it('exposes a download template control', () => {
    render(<TagAssignmentUpload {...defaultProps()} />, { wrapper: createWrapper() })
    expect(screen.getByText(/template/i)).toBeInTheDocument()
  })

  it('calls onFileSelected when an XLSX is uploaded', async () => {
    const user = userEvent.setup()
    render(<TagAssignmentUpload {...defaultProps()} />, { wrapper: createWrapper() })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['fake xlsx bytes'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    await user.upload(fileInput, file)
    expect(mockOnFileSelected).toHaveBeenCalledWith(file)
  })
})
