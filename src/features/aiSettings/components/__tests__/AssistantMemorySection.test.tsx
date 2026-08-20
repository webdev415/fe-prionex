/**
 * AssistantMemorySection — админский раздел «Память» на странице настроек AI.
 *
 * Замокан транспорт памяти и справочник пользователей, хуки React Query
 * настоящие: раскрытие строки обязано реально сходить за записями скоупа, а
 * удаление — дойти до DELETE и пережить последующую инвалидацию.
 * PermissionGuard управляется моком @/hooks; i18n-мок из src/test/setup.ts
 * отдаёт ключи, поэтому проверки идут по ключам.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AssistantMemorySection } from '../AssistantMemorySection'
import { useHasPermission } from '@/hooks'
import type { AssistantMemoryItem } from '@/features/aiAssistant/api'
import type { UserListResponse } from '@/features/users/types'
import type {
  AssistantMemoryScopeDetail,
  AssistantMemoryScopeSummary,
} from '../../api/assistantMemoryService'

const { mockGetSummary, mockGetScope, mockDeleteRecord, mockGetUsers } = vi.hoisted(() => ({
  mockGetSummary: vi.fn(),
  mockGetScope: vi.fn(),
  mockDeleteRecord: vi.fn(),
  mockGetUsers: vi.fn(),
}))

vi.mock('../../api/assistantMemoryService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api/assistantMemoryService')>()
  return {
    ...original,
    getAssistantMemorySummary: mockGetSummary,
    getAssistantMemoryScope: mockGetScope,
    deleteAssistantMemoryRecord: mockDeleteRecord,
  }
})

vi.mock('@/features/users/api/usersApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/users/api/usersApi')>()
  return { ...original, getUsers: mockGetUsers }
})

vi.mock('@/hooks', () => ({
  useHasPermission: vi.fn(),
  useHasAnyPermission: vi.fn(() => false),
  useHasAllPermissions: vi.fn(() => false),
}))

const authState = { isAuthenticated: true }
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector(authState),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const mockUseHasPermission = vi.mocked(useHasPermission)

const SUMMARY: AssistantMemoryScopeSummary[] = [
  { scope: 'user:6951', records: 65, last_at: '2026-08-10T08:30:00Z' },
  { scope: 'global', records: 12, last_at: '2026-07-01T12:00:00Z' },
  { scope: 'user:7002', records: 3, last_at: null },
]

function record(id: number, extra: Partial<AssistantMemoryItem> = {}): AssistantMemoryItem {
  return {
    id,
    kind: 'note',
    title: `Факт ${id}`,
    content: `Содержимое ${id}`,
    source: 'agent',
    created_at: '2026-08-05T09:00:00Z',
    ...extra,
  }
}

/** Записи скоупа, живущие между запросами — чтобы refetch отражал удаление. */
let scopeStore: Record<string, AssistantMemoryItem[]> = {}

const USERS: UserListResponse = {
  users: [
    {
      id: 6951,
      username: 'ivanov',
      email: 'ivanov@example.com',
      first_name: 'Иван',
      last_name: 'Иванов',
      full_name: 'Иван Иванов',
      language: 'uk',
      timezone: 'Europe/Kyiv',
      status: 'active',
      must_change_password: false,
      failed_login_attempts: 0,
      created_at: '2026-01-01T00:00:00Z',
      is_agent: true,
      two_factor_enabled: false,
      two_factor_has_secret: false,
    },
  ],
  pagination: { page: 1, page_size: 100, total_count: 1, total_pages: 1 },
}

/** Раскрыть строку скоупа, не завися от того, успел ли догрузиться справочник имён. */
function expandScope(scope: string): HTMLElement {
  return within(screen.getByTestId(`assistant-memory-scope-${scope}`)).getByRole('button')
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantMemorySection />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authState.isAuthenticated = true
  mockUseHasPermission.mockReturnValue(true)
  scopeStore = {
    'user:6951': [record(11), record(12, { source: 'user' })],
    global: [record(21, { source: 'seed' })],
  }
  mockGetSummary.mockResolvedValue(SUMMARY)
  mockGetScope.mockImplementation(async (scope: string): Promise<AssistantMemoryScopeDetail> => {
    const items = scopeStore[scope] ?? []
    return { scope, items, total: items.length }
  })
  mockDeleteRecord.mockImplementation(async (id: number) => {
    for (const scope of Object.keys(scopeStore)) {
      scopeStore[scope] = scopeStore[scope].filter((item) => item.id !== id)
    }
  })
  mockGetUsers.mockResolvedValue(USERS)
})

describe('AssistantMemorySection', () => {
  it('stays hidden without manage_ai_settings', () => {
    mockUseHasPermission.mockReturnValue(false)
    renderSection()
    expect(screen.queryByTestId('assistant-memory-section')).not.toBeInTheDocument()
  })

  it('renders the scope summary with the shared reference on top', async () => {
    renderSection()

    expect(await screen.findByTestId('assistant-memory-card')).toBeInTheDocument()
    const rows = screen.getAllByTestId(/^assistant-memory-scope-/)
    expect(rows.map((row) => row.dataset.testid)).toEqual([
      'assistant-memory-scope-global',
      'assistant-memory-scope-user:6951',
      'assistant-memory-scope-user:7002',
    ])

    expect(screen.getByText('pages.aiSettings.memory.globalScope')).toBeInTheDocument()
    expect(screen.getByText('65')).toBeInTheDocument()
    // Имя сотрудника подтягивается из справочника, неизвестный id остаётся id.
    expect(await screen.findByText('Иван Иванов')).toBeInTheDocument()
    expect(screen.getByText('pages.aiSettings.memory.unknownUser')).toBeInTheDocument()
  })

  it('loads the records of a scope only when its row is expanded', async () => {
    const user = userEvent.setup()
    renderSection()

    await screen.findByTestId('assistant-memory-card')
    expect(mockGetScope).not.toHaveBeenCalled()

    await user.click(expandScope('user:6951'))

    expect(await screen.findByTestId('assistant-memory-record-11')).toBeInTheDocument()
    expect(mockGetScope).toHaveBeenCalledWith('user:6951')
    expect(screen.getByText('Содержимое 12')).toBeInTheDocument()
  })

  it('deletes a record and refreshes the summary', async () => {
    const user = userEvent.setup()
    renderSection()

    await screen.findByTestId('assistant-memory-card')
    await user.click(expandScope('user:6951'))
    await screen.findByTestId('assistant-memory-record-11')

    await user.click(screen.getByTestId('assistant-memory-delete-11'))

    expect(mockDeleteRecord).toHaveBeenCalledWith(11)
    await waitFor(() =>
      expect(screen.queryByTestId('assistant-memory-record-11')).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('assistant-memory-record-12')).toBeInTheDocument()
    // Счётчик записей в сводке обязан пересчитаться, а не разъехаться со списком.
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(2))
  })

  it('shows the unavailable card when the memory service is down', async () => {
    mockGetSummary.mockRejectedValue(
      Object.assign(new Error('Bad Gateway'), {
        response: { status: 502, data: { detail: { code: 'brain_unreachable' } } },
      })
    )
    renderSection()

    expect(await screen.findByTestId('assistant-memory-unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-memory-card')).not.toBeInTheDocument()
  })
})
