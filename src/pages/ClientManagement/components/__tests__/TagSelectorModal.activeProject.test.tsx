/**
 * TagSelectorModal — the catalogue of the active project (story 17-56b, bot
 * review round 1, M-2).
 *
 * The single-client "Manage tags" modal was mounted with `projectId={1}` on the
 * clients page and on the client card, so in the Canadian project it offered —
 * and let the operator assign — project 1's tags. It now reads the active
 * project itself, as the bulk modal does: in project 3 the catalogue request
 * carries 3; without an active project no catalogue is asked for and none is
 * offered — not even one the page cached without a project under the same key
 * (its filter bar asks for the tags without one) — the client's own tags stay
 * listed. The tags hooks are real — only
 * the requests are stubbed — so the scenes see the project id the request is
 * actually sent with.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { tagsApi } from '@/features/tags/api/tagsApi'
import { tagsKeys } from '@/features/tags/hooks/useTags'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { TagSelectorModal } from '../TagSelectorModal'

// The payload-tag branch opens a separate dialog and is out of scope here.
vi.mock('../PromiseAssignDialog', () => ({ PromiseAssignDialog: () => null }))

const CATALOGUE_TAG = {
  id: 11,
  name: 'Tag of the active project',
  color: '#123456',
  visibility: 'visible',
}
const CLIENT_TAG = {
  id: 21,
  name: 'Tag the client already has',
  color: '#654321',
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
      <TagSelectorModal clientId={42} clientName="Test Client" open onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe('TagSelectorModal — the catalogue of the active project', () => {
  let getTags: MockInstance<typeof tagsApi.getTags>

  beforeEach(() => {
    getTags = vi
      .spyOn(tagsApi, 'getTags')
      .mockResolvedValue([CATALOGUE_TAG] as unknown as Awaited<ReturnType<typeof tagsApi.getTags>>)
    vi.spyOn(tagsApi, 'getClientTags').mockResolvedValue([CLIENT_TAG] as unknown as Awaited<
      ReturnType<typeof tagsApi.getClientTags>
    >)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({ user: null })
  })

  it('TS-1: in project 3 it asks for the catalogue of project 3', async () => {
    setActiveProject('3')
    renderModal()

    expect(await screen.findByText(CATALOGUE_TAG.name)).toBeInTheDocument()
    expect(getTags.mock.calls).toEqual([[3]])
  })

  it("TS-2: without an active project it asks for no catalogue and offers none — the client's own tags stay", async () => {
    setActiveProject(null)
    renderModal()

    expect(await screen.findByText(CLIENT_TAG.name)).toBeInTheDocument()
    expect(getTags).not.toHaveBeenCalled()
    expect(screen.queryByText(CATALOGUE_TAG.name)).not.toBeInTheDocument()
  })

  it('TS-3: without an active project a catalogue the page already cached without a project is not offered', async () => {
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

    expect(await screen.findByText(CLIENT_TAG.name)).toBeInTheDocument()
    expect(screen.queryByText('Tag of project 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Tag of project 3')).not.toBeInTheDocument()
    expect(getTags).not.toHaveBeenCalled()
  })
})
