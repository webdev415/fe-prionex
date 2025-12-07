/**
 * ImpersonationBanner Component Tests
 *
 * Tests for impersonation banner that displays when admin is viewing
 * the application as another user.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImpersonationBanner } from '../components/ImpersonationBanner'

const mockImpersonatedUser = {
  id: '5',
  username: 'john_doe',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
}

const mockOnExitImpersonation = vi.fn()

describe('ImpersonationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when not impersonating', () => {
      const { container } = render(
        <ImpersonationBanner
          isImpersonating={false}
          impersonatedUser={null}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(container.firstChild).toBeNull()
    })

    it('should render banner when impersonating', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByRole('banner')).toBeInTheDocument()
    })

    it('should display impersonated username', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/john_doe/i)).toBeInTheDocument()
    })

    it('should display "Viewing as" message', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/viewing as/i)).toBeInTheDocument()
    })

    it('should display exit button', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByRole('button', { name: /exit view/i })).toBeInTheDocument()
    })

    it('should have blue/info styling for visibility', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const banner = screen.getByRole('banner')
      expect(banner).toHaveClass('bg-blue-600')
    })

    it('should be sticky at the top', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const banner = screen.getByRole('banner')
      expect(banner).toHaveClass('sticky')
      expect(banner).toHaveClass('top-0')
    })
  })

  describe('Exit impersonation', () => {
    it('should call onExitImpersonation when exit button clicked', async () => {
      const user = userEvent.setup()

      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const exitButton = screen.getByRole('button', { name: /exit view/i })
      await user.click(exitButton)

      expect(mockOnExitImpersonation).toHaveBeenCalledTimes(1)
    })

    it('should disable exit button when loading', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={true}
        />
      )

      const exitButton = screen.getByRole('button', { name: /exit view/i })
      expect(exitButton).toBeDisabled()
    })

    it('should show loading indicator when loading', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={true}
        />
      )

      expect(screen.getByText(/exiting/i)).toBeInTheDocument()
    })
  })

  describe('User information display', () => {
    it('should display full name when available', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/John Doe/)).toBeInTheDocument()
    })

    it('should display username only when no full name', () => {
      const userWithoutName = {
        ...mockImpersonatedUser,
        firstName: undefined,
        lastName: undefined,
      }

      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={userWithoutName}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText('john_doe')).toBeInTheDocument()
      expect(screen.queryByText(/John Doe/)).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have appropriate role for banner', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByRole('banner')).toBeInTheDocument()
    })

    it('should have clear button label', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const button = screen.getByRole('button', { name: /exit view/i })
      expect(button).toHaveAccessibleName()
    })

    it('should have high color contrast for visibility', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const banner = screen.getByRole('banner')
      // Should have white text on dark blue background
      expect(banner).toHaveClass('text-white')
    })
  })

  describe('Z-index layering', () => {
    it('should have high z-index to stay on top', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const banner = screen.getByRole('banner')
      expect(banner).toHaveClass('z-50')
    })
  })
})
