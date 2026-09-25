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
import type { User } from '@/types/api'

const mockImpersonatedUser: User = {
  id: '5',
  username: 'john_doe',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  active_role_id: '10',
  active_role_name: 'Admin',
  active_project_id: '1',
  active_department_id: null,
  projects: [{ id: '1', name: 'Test Project', roles: [] }],
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

      expect(screen.getByText(/components\.impersonation\.mode/)).toBeInTheDocument()
    })

    it('should display impersonated user full name', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
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

      expect(screen.getByText(/components\.impersonation\.viewingAs/)).toBeInTheDocument()
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

      expect(
        screen.getByRole('button', { name: /components\.impersonation\.exit\b/ })
      ).toBeInTheDocument()
    })

    it('should have card background styling for visibility', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const banner = screen
        .getByText(/components\.impersonation\.mode/)
        .closest('div')?.parentElement
      expect(banner).toHaveClass('bg-card')
    })

    it('should render with proper layout structure', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const container = screen.getByText(/components\.impersonation\.mode/).closest('div')
        ?.parentElement?.parentElement
      expect(container).toHaveClass('w-full')
      expect(container).toHaveClass('flex')
      expect(container).toHaveClass('items-center')
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

      const exitButton = screen.getByRole('button', { name: /components\.impersonation\.exit\b/ })
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

      const exitButton = screen.getByRole('button', { name: /components\.impersonation\.exiting/ })
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

      expect(screen.getByText(/components\.impersonation\.exiting/)).toBeInTheDocument()
    })
  })

  describe('User information display', () => {
    it('should display full name and role', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
      expect(screen.getByText(/Admin/i)).toBeInTheDocument()
    })

    it('should display project name', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/test project/i)).toBeInTheDocument()
    })

    it('should display unknown role when role is not available', () => {
      const userWithoutRole = {
        ...mockImpersonatedUser,
        active_role_name: null,
      }

      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={userWithoutRole}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/components\.impersonation\.unknownRole/)).toBeInTheDocument()
    })

    it('should display unknown project when project is not available', () => {
      const userWithoutProject = {
        ...mockImpersonatedUser,
        active_project_id: null,
      }

      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={userWithoutProject}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/components\.impersonation\.unknownProject/)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should display impersonation mode text', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      expect(screen.getByText(/components\.impersonation\.mode/)).toBeInTheDocument()
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

      const button = screen.getByRole('button', { name: /components\.impersonation\.exit\b/ })
      expect(button).toHaveAccessibleName()
    })

    it('should have proper styling for visibility', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const bannerContainer = screen
        .getByText(/components\.impersonation\.mode/)
        .closest('div')?.parentElement
      expect(bannerContainer).toHaveClass('bg-card')
    })
  })

  describe('Layout and styling', () => {
    it('should have proper container structure', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const mainContainer = screen.getByText(/components\.impersonation\.mode/).closest('div')
        ?.parentElement?.parentElement
      expect(mainContainer).toHaveClass('w-full')
      expect(mainContainer).toHaveClass('flex')
    })

    it('should have rounded corners and proper height', () => {
      render(
        <ImpersonationBanner
          isImpersonating={true}
          impersonatedUser={mockImpersonatedUser}
          onExitImpersonation={mockOnExitImpersonation}
          isLoading={false}
        />
      )

      const bannerCard = screen
        .getByText(/components\.impersonation\.mode/)
        .closest('div')?.parentElement
      expect(bannerCard).toHaveClass('rounded-md')
      expect(bannerCard).toHaveClass('h-[65px]')
    })
  })
})
