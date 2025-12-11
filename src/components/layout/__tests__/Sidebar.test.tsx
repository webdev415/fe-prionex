import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar, type SidebarItem, type SidebarAction } from '../Sidebar'

const mockItems: SidebarItem[] = [
  { path: '/dashboard', icon: 'home-04', label: 'Dashboard' },
  { path: '/analytics', icon: 'analytics-01', label: 'Analytics' },
  { path: '/settings', icon: 'setting-07', label: 'Settings', disabled: true },
]

const mockActions: SidebarAction[] = [
  { icon: 'logout-square-01', label: 'Logout', onClick: vi.fn() },
]

const renderSidebar = (props = {}, initialPath = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar items={mockItems} actions={mockActions} {...props} />
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  it('renders navigation items', () => {
    renderSidebar()
    expect(screen.getByLabelText('Dashboard')).toBeInTheDocument()
    expect(screen.getByLabelText('Analytics')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('renders menu button', () => {
    const onMenuClick = vi.fn()
    renderSidebar({ onMenuClick })
    expect(screen.getByLabelText('Menu')).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    renderSidebar()
    expect(screen.getByLabelText('Logout')).toBeInTheDocument()
  })

  it('disables items when disabled prop is true', () => {
    renderSidebar()
    const settingsItem = screen.getByLabelText('Settings')
    expect(settingsItem).not.toHaveAttribute('href')
  })

  it('applies custom className', () => {
    const { container } = renderSidebar({ className: 'custom-sidebar' })
    const sidebar = container.querySelector('aside')
    expect(sidebar).toHaveClass('custom-sidebar')
  })

  // STYLING STANDARDIZATION TESTS (Phase 3)

  it('Active NavLink should NOT have inline style attribute', () => {
    const { container } = renderSidebar({}, '/dashboard')
    // Dashboard should be active since we're at "/dashboard"
    const navLinks = container.querySelectorAll('a[href="/dashboard"]')
    navLinks.forEach((link) => {
      expect(link).not.toHaveAttribute('style')
    })
  })

  it('Active NavLink should use Tailwind class for background color (not inline style)', () => {
    const { container } = renderSidebar({}, '/dashboard')
    // Dashboard NavLink should have Tailwind bg class
    const dashboardLink = container.querySelector('a[href="/dashboard"]')
    expect(dashboardLink).toHaveClass('bg-secondary-800')
  })

  it('Inactive NavLink should NOT have inline style attribute', () => {
    const { container } = renderSidebar()
    const analyticsLink = container.querySelector('a[href="/analytics"]')
    expect(analyticsLink).not.toHaveAttribute('style')
  })
})
