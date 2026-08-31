/**
 * AssistantInternalsSection tests — the read-only «Устройство ассистента»
 * config card (model/commit/flags/limits). Persona, prompt append and
 * skills live in AssistantManagementSection now and are covered there.
 * API layer mocked, hook is real. PermissionGuard driven via the @/hooks
 * mock; the i18n mock in src/test/setup.ts returns keys, so assertions use
 * keys.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssistantInternalsSection } from '../AssistantInternalsSection'
import { assistantOverviewTestMocks } from '@/test/mocks/assistantOverview'
import { useHasPermission } from '@/hooks'
import type { AssistantOverview } from '../../api/assistantOverviewService'

const { mockGetAssistantOverview } = assistantOverviewTestMocks

const authState = { isAuthenticated: true }

vi.mock('@/hooks', () => ({
  useHasPermission: vi.fn(),
  useHasAnyPermission: vi.fn(() => false),
  useHasAllPermissions: vi.fn(() => false),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector(authState),
}))

const mockUseHasPermission = vi.mocked(useHasPermission)

const OVERVIEW: AssistantOverview = {
  config: {
    model: '31b-thinking',
    commit: 'abc1234',
    flags: {
      thinking_mode_enabled: true,
      skills_enabled: true,
      hooks_enabled: false,
      crm_mode: true,
      memory_enabled: true,
      knowledge_enabled: false,
      query_router_enabled: true,
      answer_eval_enabled: false,
      tts_normalize_enabled: true,
      corrector_enabled: false,
      rbac_scope_enabled: true,
      call_qa_enabled: true,
    },
    limits: {
      max_turns: 12,
      turn_deadline_s: 45,
      sql_max_rows: 500,
      prompt_append_limit: 2000,
    },
    manifest: { skills: ['draft_tools'] },
  },
  prompts: {
    persona: {
      name: 'Роша',
      role: 'operator assistant',
      tone: 'formal',
      language: 'ru',
      apply: 'gw-restart',
    },
    prompt0_append: {
      template: 'Дополнительный контекст оператора',
      text: 'Дополнительный контекст оператора',
      length: 34,
      limit: 2000,
      apply: 'hot-reload',
    },
    skills: [
      { name: 'search_clients', text: 'skill body 1', apply: 'hot-reload' },
      { name: 'draft_tools', text: 'skill body 2', apply: 'gw-restart' },
    ],
    knowledge: { apply: 'reseed', files: ['assistant_knowledge.md', 'policies.md'] },
  },
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantInternalsSection />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockGetAssistantOverview.mockReset()
  mockUseHasPermission.mockReset()
  authState.isAuthenticated = true
  mockUseHasPermission.mockReturnValue(true)
})

describe('AssistantInternalsSection', () => {
  it('stays hidden without the manage_ai_settings permission', () => {
    mockUseHasPermission.mockReturnValue(false)
    mockGetAssistantOverview.mockResolvedValue(OVERVIEW)
    renderSection()
    expect(screen.queryByTestId('assistant-internals-section')).not.toBeInTheDocument()
  })

  it('renders a skeleton while loading', () => {
    mockGetAssistantOverview.mockReturnValue(new Promise(() => {}))
    renderSection()
    expect(screen.getByTestId('assistant-internals-skeleton')).toBeInTheDocument()
  })

  it('renders config flags and limits once loaded', async () => {
    mockGetAssistantOverview.mockResolvedValue(OVERVIEW)
    renderSection()

    await waitFor(() =>
      expect(screen.getByTestId('assistant-internals-config')).toBeInTheDocument()
    )

    expect(screen.getByText('31b-thinking')).toBeInTheDocument()
    expect(screen.getByText('abc1234')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()

    // Prompting artifacts moved to AssistantManagementSection — a second
    // read-only copy here is exactly what that move removed.
    expect(screen.queryByTestId('assistant-internals-prompts')).not.toBeInTheDocument()
    expect(screen.queryByText('Роша')).not.toBeInTheDocument()
  })

  it('shows the unavailable card on a 502 without breaking the rest of the page', async () => {
    mockGetAssistantOverview.mockRejectedValue(
      Object.assign(new Error('Bad Gateway'), {
        response: { status: 502, data: { detail: { code: 'brain_unreachable' } } },
      })
    )
    renderSection()

    await waitFor(() =>
      expect(screen.getByTestId('assistant-internals-unavailable')).toBeInTheDocument()
    )
    expect(screen.getByText('pages.aiSettings.internals.unavailable')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-internals-config')).not.toBeInTheDocument()
  })
})
