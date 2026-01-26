import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardLayout } from '../DashboardLayout'

// Mock dependencies
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    isImpersonating: false,
    impersonatedUser: null,
    exitImpersonation: vi.fn(),
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { permissions: [] } }),
}))

vi.mock('@/hooks', () => ({
  usePermissionRefresh: () => {},
}))

vi.mock('@/api/clientSearchApi', () => ({
  searchClients: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    query: '',
    search_type: 'all',
  }),
  mapPriorityLevel: (level: string) => level.charAt(0).toUpperCase() + level.slice(1),
}))

vi.mock('@/stores/sidebarStore', () => ({
  useSidebarStore: () => ({
    isOpenSideBar: false,
    toggleSidebar: vi.fn(),
  }),
}))

vi.mock('@/stores/callStore', () => ({
  useCallStore: () => ({
    minimizedCall: null,
    clearMinimizedCall: vi.fn(),
    setOpenCallModal: vi.fn(),
  }),
}))

vi.mock('@/features/calls/hooks/useIncomingCall', () => ({
  useIncomingCall: () => ({
    incomingCall: null,
    dismissIncomingCall: vi.fn(),
  }),
}))

const renderDashboardLayout = () => {
  return render(
    <MemoryRouter>
      <DashboardLayout>
        <div data-testid="child-content">Test Content</div>
      </DashboardLayout>
    </MemoryRouter>
  )
}

describe('DashboardLayout', () => {
  it('renders children', () => {
    const { getByTestId } = renderDashboardLayout()
    expect(getByTestId('child-content')).toBeInTheDocument()
  })

  it('renders sidebar', () => {
    const { container } = renderDashboardLayout()
    const sidebar = container.querySelector('aside')
    expect(sidebar).toBeInTheDocument()
  })

  it('renders header with search bar', () => {
    const { container } = renderDashboardLayout()
    const header = container.querySelector('header')
    expect(header).toBeInTheDocument()
  })

  // STYLING STANDARDIZATION TESTS (Phase 3)

  it('Main wrapper should NOT have inline style attribute for background', () => {
    const { container } = renderDashboardLayout()
    const mainWrapper = container.querySelector('.bg-light-50.min-h-screen')
    // Should not have inline style, use Tailwind classes or CSS background utility
    expect(mainWrapper).not.toHaveAttribute('style')
  })

  it('Main wrapper should use Tailwind classes for background image', () => {
    const { container } = renderDashboardLayout()
    const mainWrapper = container.querySelector('.bg-light-50.min-h-screen')
    // Should have a class for background image
    expect(mainWrapper?.className).toContain('bg-')
  })

  it('Header should NOT have inline style attribute for border and shadow', () => {
    const { container } = renderDashboardLayout()
    const header = container.querySelector('header')
    // Should not have inline style, use Tailwind border and shadow classes
    expect(header).not.toHaveAttribute('style')
  })

  it('Header should use Tailwind classes for border and shadow', () => {
    const { container } = renderDashboardLayout()
    const header = container.querySelector('header')
    // Should have Tailwind border and shadow classes
    expect(header).toHaveClass('border-l')
    expect(header).toHaveClass('shadow-sm')
  })
})
