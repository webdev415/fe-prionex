import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlreadyLoggedInCard } from '../components/AlreadyLoggedInCard'

describe('AlreadyLoggedInCard', () => {
  const mockOnForceLogout = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    mockOnForceLogout.mockClear()
    mockOnCancel.mockClear()
  })

  it('renders already logged in message', () => {
    render(<AlreadyLoggedInCard onForceLogout={mockOnForceLogout} onCancel={mockOnCancel} />)

    // Use getByRole since the message appears in both heading and alert
    expect(screen.getByRole('heading', { name: /already logged in/i })).toBeInTheDocument()
  })

  it('renders force logout button', () => {
    render(<AlreadyLoggedInCard onForceLogout={mockOnForceLogout} onCancel={mockOnCancel} />)

    expect(screen.getByRole('button', { name: /force logout/i })).toBeInTheDocument()
  })

  it('renders cancel button', () => {
    render(<AlreadyLoggedInCard onForceLogout={mockOnForceLogout} onCancel={mockOnCancel} />)

    expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument()
  })

  it('calls onForceLogout when force logout button is clicked', async () => {
    const user = userEvent.setup()
    mockOnForceLogout.mockResolvedValue(undefined)
    render(<AlreadyLoggedInCard onForceLogout={mockOnForceLogout} onCancel={mockOnCancel} />)

    await user.click(screen.getByRole('button', { name: /force logout/i }))

    expect(mockOnForceLogout).toHaveBeenCalled()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<AlreadyLoggedInCard onForceLogout={mockOnForceLogout} onCancel={mockOnCancel} />)

    await user.click(screen.getByRole('button', { name: /back to login/i }))

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('disables buttons when isLoading is true', () => {
    render(
      <AlreadyLoggedInCard onForceLogout={mockOnForceLogout} onCancel={mockOnCancel} isLoading />
    )

    expect(screen.getByRole('button', { name: /back to login/i })).toBeDisabled()
  })

  it('shows session warning message', () => {
    render(<AlreadyLoggedInCard onForceLogout={mockOnForceLogout} onCancel={mockOnCancel} />)

    expect(screen.getByText(/you are already logged in on another device/i)).toBeInTheDocument()
  })
})
