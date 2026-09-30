/**
 * BulkTagModal — bulk "Add tags" offers the tags of the active project
 * (story 17-56b, AC-2; DEV acceptance of 17-56, finding F-4).
 *
 * The modal asked for project 1's tags in every project (a hardcoded id), so an
 * operator in the Canadian project was offered Ukrainian tags. It now takes the
 * active project from the auth store; without one it asks for nothing and shows
 * the usual empty list — even when the page's own tag queries have already
 * cached a list without a project under the same key. The tags hook is real —
 * only the request is stubbed — so the scenes see the project id the request is
 * actually sent with.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { tagsApi } from '@/features/tags/api/tagsApi'
import { tagsKeys } from '@/features/tags/hooks/useTags'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { BulkTagModal } from '../BulkTagModal'

const TAG_OF_PROJECT = {
  id: 11,
  name: 'Tag of the active project',
  color: '#123456',
  visibility: 'visible',
}

function setActiveProject(projectId: string | null) {
  useAuthStore.setState({ user: { id: '1', active_project_id: projectId } as unknown as User })
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderModal(qc = newQueryClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <BulkTagModal open clientIds={[416]} clientCount={1} action="add" onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe('BulkTagModal — tags of the active project', () => {
  let getTags: MockInstance<typeof tagsApi.getTags>

  beforeEach(() => {
    getTags = vi
      .spyOn(tagsApi, 'getTags')
      .mockResolvedValue([TAG_OF_PROJECT] as unknown as Awaited<ReturnType<typeof tagsApi.getTags>>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({ user: null })
  })

  it('BT-1: in project 3 it asks for the tags of project 3', async () => {
    setActiveProject('3')
    renderModal()

    expect(await screen.findByText(TAG_OF_PROJECT.name)).toBeInTheDocument()
    expect(getTags.mock.calls).toEqual([[3]])
  })

  it('BT-2: in project 1 it asks for the tags of project 1', async () => {
    setActiveProject('1')
    renderModal()

    expect(await screen.findByText(TAG_OF_PROJECT.name)).toBeInTheDocument()
    expect(getTags.mock.calls).toEqual([[1]])
  })

  it('BT-3: without an active project it asks for nothing and shows the usual empty list', async () => {
    setActiveProject(null)
    renderModal()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getTags).not.toHaveBeenCalled()
    expect(screen.getByText('pages.clients.modals.bulkTag.noTagsFound')).toBeInTheDocument()
  })

  it('BT-4: without an active project a list the page already cached without a project is not offered', async () => {
    setActiveProject(null)
    const qc = newQueryClient()
    // The key the hook reads without a project: the filter bar and the page fill it.
    qc.setQueryData(
      [
        ...tagsKeys.list(undefined),
        { includeHidden: false, roleName: undefined, activeDepartmentId: undefined },
      ],
      [
        { id: 1, name: 'Tag of project 1', color: '#111111', visibility: 'visible' },
        { id: 3, name: 'Tag of project 3', color: '#333333', visibility: 'visible' },
      ]
    )
    renderModal(qc)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.getByText('pages.clients.modals.bulkTag.noTagsFound')).toBeInTheDocument()
    expect(screen.queryByText('Tag of project 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Tag of project 3')).not.toBeInTheDocument()
    expect(getTags).not.toHaveBeenCalled()
  })
})
