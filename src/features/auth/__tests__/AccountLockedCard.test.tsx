import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountLockedCard } from '../components/AccountLockedCard'

const mockOnBackToLogin = vi.fn()

describe('AccountLockedCard', () => {
  it('renders account locked message', () => {
    render(<AccountLockedCard onBackToLogin={mockOnBackToLogin} />)

    const heading = screen.getByRole('heading', { name: /account locked/i })
    expect(heading).toBeInTheDocument()
  })

  it('displays lockout message with minutes when provided', () => {
    render(<AccountLockedCard lockoutMinutes={15} onBackToLogin={mockOnBackToLogin} />)

    // Text is split across multiple elements, so use a more flexible matcher
    expect(screen.getByText(/it will be unlocked automatically in 15 minutes/i)).toBeInTheDocument()
  })

  it('displays contact admin message', () => {
    render(<AccountLockedCard onBackToLogin={mockOnBackToLogin} />)

    expect(screen.getByText(/contact/i)).toBeInTheDocument()
  })

  it('calls onBackToLogin when button is clicked', async () => {
    const user = userEvent.setup()
    render(<AccountLockedCard onBackToLogin={mockOnBackToLogin} />)

    const button = screen.getByRole('button', { name: /back to login/i })
    await user.click(button)

    expect(mockOnBackToLogin).toHaveBeenCalled()
  })
})
