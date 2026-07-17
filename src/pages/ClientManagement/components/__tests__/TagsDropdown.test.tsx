/**
 * Unit tests for TagsDropdown segment / manual mutual exclusivity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TagsDropdown } from '../TagsDropdown'
import type { Segment, Tag } from '@/features/tags/types'

const mockSegments: Segment[] = [
  {
    id: 10,
    project_id: 1,
    name: 'High Risk',
    code: 'high_risk',
    refresh_mode: 'on_demand',
    cached_client_count: 1240,
    last_refreshed_at: '2026-07-16T14:32:00Z',
    is_active: true,
    conditions: [],
  },
  {
    id: 11,
    project_id: 1,
    name: 'PTP Due',
    code: 'ptp_due',
    refresh_mode: 'scheduled',
    cached_client_count: 42,
    last_refreshed_at: undefined,
    is_active: true,
    conditions: [],
  },
]

const mockTags: Tag[] = [
  {
    id: 1,
    name: 'Contacted',
    color: '#00aa00',
    project_id: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Promised',
    color: '#0000aa',
    project_id: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
]

vi.mock('@/features/tags/hooks/useTags', () => ({
  useSegments: () => ({ data: mockSegments, isLoading: false }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { timezone: string } }) => unknown) =>
    selector({ user: { timezone: 'Europe/Kyiv' } }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'pages.clients.modals.tagsDropdown.tabManual': 'Manual filter',
        'pages.clients.modals.tagsDropdown.tabSegments': 'Segments',
        'pages.clients.modals.tagsDropdown.searchTags': 'Search tags...',
        'pages.clients.modals.tagsDropdown.searchSegments': 'Search segments...',
        'pages.clients.modals.tagsDropdown.noTagsFound': 'No tags found',
        'pages.clients.modals.tagsDropdown.noSegmentsFound': 'No active segments found',
        'pages.clients.modals.tagsDropdown.loadingSegments': 'Loading segments...',
        'pages.clients.modals.tagsDropdown.clear': 'Clear',
        'pages.clients.modals.tagsDropdown.apply': 'Apply',
        'pages.clients.modals.tagsDropdown.segmentClients': `${opts?.count ?? 0} clients`,
        'pages.clients.modals.tagsDropdown.segmentMeta': `${opts?.clients} · updated at ${opts?.time}`,
      }
      return map[key] ?? key
    },
  }),
}))

function renderDropdown(props: Partial<React.ComponentProps<typeof TagsDropdown>> = {}) {
  const onSelectionChange = vi.fn()
  const onSegmentChange = vi.fn()
  const onClear = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={client}>
      <TagsDropdown
        tags={mockTags}
        tagFilterSelection={{ includeIds: [], excludeIds: [] }}
        selectedSegmentId={null}
        onSelectionChange={onSelectionChange}
        onSegmentChange={onSegmentChange}
        onClear={onClear}
        trigger={<button type="button">Open</button>}
        {...props}
      />
    </QueryClientProvider>
  )

  return { onSelectionChange, onSegmentChange, onClear }
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Open'))
  expect(await screen.findByText(/Manual filter/)).toBeInTheDocument()
}

describe('TagsDropdown segments tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Manual and Segments tabs', async () => {
    const user = userEvent.setup()
    renderDropdown()
    await openMenu(user)
    expect(screen.getByText('Segments')).toBeInTheDocument()
  })

  it('lists active segments with count and refreshed time', async () => {
    const user = userEvent.setup()
    renderDropdown()
    await openMenu(user)
    await user.click(screen.getByText('Segments'))

    expect(await screen.findByText('High Risk')).toBeInTheDocument()
    expect(screen.getByText(/1240 clients/)).toBeInTheDocument()
    expect(screen.getByText(/updated at/)).toBeInTheDocument()
    expect(screen.getByText('PTP Due')).toBeInTheDocument()
    expect(screen.getByText('42 clients')).toBeInTheDocument()
  })

  it('selecting a segment clears manual tags via onSegmentChange', async () => {
    const user = userEvent.setup()
    const { onSelectionChange, onSegmentChange } = renderDropdown({
      tagFilterSelection: { includeIds: [1], excludeIds: [2] },
    })
    await openMenu(user)
    await user.click(screen.getByText('Segments'))
    await user.click(await screen.findByText('High Risk'))

    expect(onSegmentChange).toHaveBeenCalledWith(10)
    // Parent (ClientFiltersBar) clears tagIds when segment is set
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('setting a manual tag notifies selection (parent clears segment)', async () => {
    const user = userEvent.setup()
    const { onSelectionChange, onSegmentChange } = renderDropdown({
      selectedSegmentId: 10,
    })
    await openMenu(user)
    // Opens on Segments when a segment is already selected
    await user.click(screen.getByText(/Manual filter/))

    await user.click(await screen.findByLabelText('Contacted filter'))

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalled()
      // Parent clears segment when manual tags become non-empty
      expect(onSegmentChange).not.toHaveBeenCalled()
    })
  })

  it('clear invokes parent onClear', async () => {
    const user = userEvent.setup()
    const { onClear } = renderDropdown({ selectedSegmentId: 10 })
    await openMenu(user)
    // Prefer the footer Clear button inside the menu (role=button, text Clear)
    const clearButtons = screen.getAllByRole('button', { name: 'Clear' })
    const footerClear = clearButtons.find((b) => b.textContent === 'Clear')
    expect(footerClear).toBeTruthy()
    await user.click(footerClear!)
    expect(onClear).toHaveBeenCalled()
  })
})
