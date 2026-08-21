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

/** Сводка старого бэкенда — без полей потолка (фронт выкатывается раньше). */
const SUMMARY: AssistantMemoryScopeSummary[] = [
  { scope: 'user:6951', records: 65, last_at: '2026-08-10T08:30:00Z' },
  { scope: 'global', records: 12, last_at: '2026-07-01T12:00:00Z' },
  { scope: 'user:7002', records: 3, last_at: null },
]

/** Сводка бэкенда с потолком: у `global` потолка нет, один скоуп переполнен. */
const SUMMARY_WITH_LIMITS: AssistantMemoryScopeSummary[] = [
  {
    scope: 'user:6951',
    records: 65,
    last_at: '2026-08-10T08:30:00Z',
    limit: 50,
    over_limit: true,
  },
  { scope: 'global', records: 12, last_at: '2026-07-01T12:00:00Z', limit: null, over_limit: false },
  { scope: 'user:7002', records: 3, last_at: null, limit: 50, over_limit: false },
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

/** Первая ступень: карточка свёрнута, список скоупов появляется по клику. */
async function openScopeList(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByTestId('assistant-memory-card')
  await user.click(screen.getByTestId('assistant-memory-toggle'))
  await screen.findAllByTestId(/^assistant-memory-scope-/)
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

  it('keeps the scope list collapsed until the card is clicked', async () => {
    const user = userEvent.setup()
    renderSection()

    await screen.findByTestId('assistant-memory-card')
    // Свёрнуто: ни строк скоупов, ни запроса справочника имён.
    expect(screen.queryAllByTestId(/^assistant-memory-scope-/)).toHaveLength(0)
    expect(mockGetUsers).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('assistant-memory-toggle'))
    expect(await screen.findByTestId('assistant-memory-scope-global')).toBeInTheDocument()

    // Повторный клик — снова прячем список.
    await user.click(screen.getByTestId('assistant-memory-toggle'))
    expect(screen.queryAllByTestId(/^assistant-memory-scope-/)).toHaveLength(0)
  })

  it('renders the scope summary with the shared reference on top', async () => {
    const user = userEvent.setup()
    renderSection()

    await openScopeList(user)
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

    await openScopeList(user)
    expect(mockGetScope).not.toHaveBeenCalled()

    await user.click(expandScope('user:6951'))

    expect(await screen.findByTestId('assistant-memory-record-11')).toBeInTheDocument()
    expect(mockGetScope).toHaveBeenCalledWith('user:6951')
    expect(screen.getByText('Содержимое 12')).toBeInTheDocument()
  })

  it('deletes a record and refreshes the summary', async () => {
    const user = userEvent.setup()
    renderSection()

    await openScopeList(user)
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

  it('shows records against the cap and marks an overflowing scope', async () => {
    mockGetSummary.mockResolvedValue(SUMMARY_WITH_LIMITS)
    const user = userEvent.setup()
    renderSection()

    await openScopeList(user)

    // Переполненный скоуп: счётчик «занято / потолок» плюс спокойный бейдж.
    expect(screen.getByText('65 / 50')).toBeInTheDocument()
    expect(screen.getByTestId('assistant-memory-over-limit-user:6951')).toHaveTextContent(
      'pages.aiSettings.memory.overLimit'
    )

    // Скоуп в пределах потолка — счётчик есть, бейджа нет.
    expect(screen.getByText('3 / 50')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-memory-over-limit-user:7002')).not.toBeInTheDocument()

    // Общий справочник не вытесняется: голое число и никакого бейджа.
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-memory-over-limit-global')).not.toBeInTheDocument()

    // Порядок строк от потолка не зависит.
    expect(
      screen.getAllByTestId(/^assistant-memory-scope-/).map((row) => row.dataset.testid)
    ).toEqual([
      'assistant-memory-scope-global',
      'assistant-memory-scope-user:6951',
      'assistant-memory-scope-user:7002',
    ])
  })

  it('keeps the plain record count when the backend knows no cap', async () => {
    const user = userEvent.setup()
    renderSection()

    await openScopeList(user)

    // SUMMARY без limit/over_limit — строка выглядит ровно как до потолка.
    expect(screen.getByText('65')).toBeInTheDocument()
    expect(screen.queryByText('65 / 50')).not.toBeInTheDocument()
    expect(screen.queryAllByTestId(/^assistant-memory-over-limit-/)).toHaveLength(0)
  })

  it('labels a consolidated record with its own origin', async () => {
    scopeStore['user:6951'] = [record(13, { source: 'consolidated' })]
    const user = userEvent.setup()
    renderSection()

    await openScopeList(user)
    await user.click(expandScope('user:6951'))

    expect(await screen.findByTestId('assistant-memory-record-13')).toBeInTheDocument()
    expect(screen.getByText('pages.aiSettings.memory.sources.consolidated')).toBeInTheDocument()
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
