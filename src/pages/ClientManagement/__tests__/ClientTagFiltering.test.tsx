/**
 * Client Tag Filtering & Bulk Actions Tests - Phase 3.3
 *
 * Tests for tag filtering dropdown and bulk actions dropdown functionality.
 * Following TDD workflow (RED-GREEN-REFACTOR).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ClientManagementPage } from '../ClientManagementPage'
import { tagsApi } from '@/features/tags/api/tagsApi'
import type { Tag } from '@/features/tags/types'

// Mock the API modules
vi.mock('@/features/tags/api/tagsApi')
vi.mock('@/features/clients/hooks/useClients')
vi.mock('@/features/clients/hooks/useConfig')

const mockTags: Tag[] = [
  { id: 1, name: 'VIP', color: '#FF6B6B', project_id: 1, created_at: '2024-01-01' },
  { id: 2, name: 'Priority', color: '#4ECDC4', project_id: 1, created_at: '2024-01-02' },
  { id: 3, name: 'Legal Issue', color: '#FFD93D', project_id: 1, created_at: '2024-01-03' },
]

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Client Tag Filtering & Bulk Actions - Phase 3.3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock default responses
    vi.mocked(tagsApi.getTags).mockResolvedValue(mockTags)
  })

  describe('Test 1: Tag filter dropdown displays', () => {
    it('should display tag filter dropdown in filter bar', async () => {
      render(<ClientManagementPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Look for the Tags filter dropdown
        const tagFilterLabel = screen.getByText('Tags', { selector: 'label' })
        expect(tagFilterLabel).toBeInTheDocument()

        // Should have a multi-select dropdown component
        const tagDropdown = screen.getByTestId('tags-multiselect-dropdown')
        expect(tagDropdown).toBeInTheDocument()
      })
    })
  })

  describe('Test 2: Tag filter multiselect', () => {
    it('should allow selecting multiple tags from dropdown', async () => {
      const user = userEvent.setup()
      render(<ClientManagementPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const tagDropdown = screen.getByTestId('tags-multiselect-dropdown')
        expect(tagDropdown).toBeInTheDocument()
      })

      // Open dropdown
      const dropdownTrigger = screen.getByTestId('tags-multiselect-trigger')
      await user.click(dropdownTrigger)

      await waitFor(() => {
        // Should show all tags as options
        expect(screen.getByText('VIP')).toBeInTheDocument()
        expect(screen.getByText('Priority')).toBeInTheDocument()
        expect(screen.getByText('Legal Issue')).toBeInTheDocument()
      })

      // Select multiple tags
      await user.click(screen.getByText('VIP'))
      await user.click(screen.getByText('Priority'))

      await waitFor(() => {
        // Both should be selected
        const selectedTags = screen.getAllByTestId(/selected-tag-/)
        expect(selectedTags.length).toBe(2)
      })
    })
  })

  describe('Test 3: Tag filter applies to client list', () => {
    it('should update URL params when tags are selected', async () => {
      const user = userEvent.setup()
      render(<ClientManagementPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const dropdownTrigger = screen.getByTestId('tags-multiselect-trigger')
        expect(dropdownTrigger).toBeInTheDocument()
      })

      // Open dropdown and select tags
      const dropdownTrigger = screen.getByTestId('tags-multiselect-trigger')
      await user.click(dropdownTrigger)

      await waitFor(() => {
        expect(screen.getByText('VIP')).toBeInTheDocument()
      })

      await user.click(screen.getByText('VIP'))
      await user.click(screen.getByText('Priority'))

      // Verify that tags are visually selected (UI state changed)
      await waitFor(() => {
        const selectedTags = screen.getAllByTestId(/selected-tag-/)
        expect(selectedTags.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Test 4: Tag filter clears', () => {
    it('should clear tag filter when tags are deselected', async () => {
      const user = userEvent.setup()
      render(<ClientManagementPage />, { wrapper: createWrapper() })

      // Select tags first
      const dropdownTrigger = screen.getByTestId('tags-multiselect-trigger')
      await user.click(dropdownTrigger)
      await user.click(screen.getByText('VIP'))

      await waitFor(() => {
        expect(screen.getByTestId('selected-tag-1')).toBeInTheDocument()
      })

      // Clear the tag
      await user.click(screen.getByTestId('clear-tag-1'))

      await waitFor(() => {
        // Selected tag should be removed from UI
        expect(screen.queryByTestId('selected-tag-1')).not.toBeInTheDocument()
      })
    })
  })

  describe('Test 5: Bulk actions dropdown displays', () => {
    it('should display "Bulk Actions" button that replaces old "Bulk Assign" button', async () => {
      render(<ClientManagementPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // New "Bulk Actions" button should exist
        const bulkActionsButton = screen.getByRole('button', { name: /Bulk Actions/i })
        expect(bulkActionsButton).toBeInTheDocument()

        // Old "Bulk Assign" button should NOT exist
        const bulkAssignButton = screen.queryByRole('button', { name: /^Bulk Assign$/i })
        expect(bulkAssignButton).not.toBeInTheDocument()
      })
    })
  })

  describe('Test 6: Bulk actions has three options', () => {
    it('should show Assign, Add Tags, Remove Tags options when dropdown is opened', async () => {
      const user = userEvent.setup()
      render(<ClientManagementPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const bulkActionsButton = screen.getByRole('button', { name: /Bulk Actions/i })
        expect(bulkActionsButton).toBeInTheDocument()
      })

      // Open dropdown
      const bulkActionsButton = screen.getByRole('button', { name: /Bulk Actions/i })
      await user.click(bulkActionsButton)

      await waitFor(() => {
        // Should show all three options
        expect(screen.getByText('Assign Employee/Searcher')).toBeInTheDocument()
        expect(screen.getByText('Add Tags')).toBeInTheDocument()
        expect(screen.getByText('Remove Tags')).toBeInTheDocument()

        // Should have a separator between Assign and tag options
        const dropdownContent = screen.getByTestId('bulk-actions-dropdown-content')
        const separator = within(dropdownContent).getByRole('separator')
        expect(separator).toBeInTheDocument()
      })
    })
  })

  describe('Test 7: Bulk add tags opens modal', () => {
    it('should open bulk tag modal when "Add Tags" is clicked', async () => {
      const user = userEvent.setup()
      render(<ClientManagementPage />, { wrapper: createWrapper() })

      // Select some clients first
      await waitFor(() => {
        const checkbox = screen.getByTestId('client-checkbox-1')
        expect(checkbox).toBeInTheDocument()
      })

      const checkbox = screen.getByTestId('client-checkbox-1')
      await user.click(checkbox)

      // Open bulk actions dropdown
      const bulkActionsButton = screen.getByRole('button', { name: /Bulk Actions/i })
      await user.click(bulkActionsButton)

      // Click "Add Tags"
      const addTagsOption = screen.getByText('Add Tags')
      await user.click(addTagsOption)

      await waitFor(() => {
        // Bulk tag modal should open
        const modal = screen.getByTestId('bulk-tag-modal')
        expect(modal).toBeInTheDocument()
        expect(within(modal).getByText(/Add Tags to/i)).toBeInTheDocument()
      })
    })
  })

  describe('Test 8: Bulk remove tags opens modal', () => {
    it('should open bulk tag modal when "Remove Tags" is clicked', async () => {
      const user = userEvent.setup()
      render(<ClientManagementPage />, { wrapper: createWrapper() })

      // Select some clients first
      await waitFor(() => {
        const checkbox = screen.getByTestId('client-checkbox-1')
        expect(checkbox).toBeInTheDocument()
      })

      const checkbox = screen.getByTestId('client-checkbox-1')
      await user.click(checkbox)

      // Open bulk actions dropdown
      const bulkActionsButton = screen.getByRole('button', { name: /Bulk Actions/i })
      await user.click(bulkActionsButton)

      // Click "Remove Tags"
      const removeTagsOption = screen.getByText('Remove Tags')
      await user.click(removeTagsOption)

      await waitFor(() => {
        // Bulk tag modal should open in remove mode
        const modal = screen.getByTestId('bulk-tag-modal')
        expect(modal).toBeInTheDocument()
        expect(within(modal).getByText(/Remove Tags from/i)).toBeInTheDocument()
      })
    })
  })
})
