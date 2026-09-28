/**
 * React Query хуки админки сайта (17-40b, r5 — раунды 1–2 бота).
 *
 * Что защищаем — живыми хуками над настоящим `QueryClient`, а не заглушками:
 *  - ответ PUT не затирает кэш настроек целиком: поля, которых в нём нет,
 *    остаются из прочитанного GET (иначе узкий ответ уводил решение о кнопке на
 *    догадку по JWT и «оживлял» выключенного владельца); поля, описывающие
 *    ПРЕЖНЕГО владельца, на новом не остаются; присланное — в том числе `null` —
 *    побеждает;
 *  - после сохранения настройки перечитываются: правду говорит GET;
 *  - сигнал отмены React Query доходит до запроса страницы проектов;
 *  - неполный список проектов не считается свежим пять минут.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { ProjectListParams, ProjectListResponse } from '@/features/projects/types'
import type { SiteAdminSettings } from '../types'

const siteAdminApiMock = vi.hoisted(() => ({
  getSiteAdminSettings: vi.fn(),
  updateSiteAdminSettings: vi.fn(),
  requestSiteAdminHandoff: vi.fn(),
}))
const getProjectsMock = vi.hoisted(() => vi.fn())

vi.mock('../api', () => ({ siteAdminApi: siteAdminApiMock }))
vi.mock('@/features/projects/api/projectsApi', () => ({
  getProjects: getProjectsMock,
  projectsApi: { getProjects: getProjectsMock },
}))

const { siteAdminKeys, useOwnerProjectChoices, useSiteAdminSettings, useUpdateSiteAdminSettings } =
  await import('../hooks')
const { OWNER_CHOICES_MAX_PAGES } = await import('../ownerChoices')

/** GET 17-40a целиком: владелец 7 выключен, вход настроен, роль editor. */
const CACHED: SiteAdminSettings = {
  site_owner_project_id: 7,
  site_owner_project_name: 'Owner Project Alpha',
  site_owner_active: false,
  configured: true,
  current_user_site_role: 'editor',
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, invalidateSpy, wrapper }
}

function page(ids: number[], totalPages: number, pageNo: number): ProjectListResponse {
  return {
    projects: ids.map((id) => ({ id, name: `Project ${id}` })),
    pagination: { page: pageNo, page_size: 100, total_items: ids.length, total_pages: totalPages },
  } as unknown as ProjectListResponse
}

describe('useUpdateSiteAdminSettings — ответ PUT и кэш настроек', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PUT уже GET (тот же владелец): отсутствующие поля остаются из кэша', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(siteAdminKeys.settings(), { ...CACHED })
    siteAdminApiMock.updateSiteAdminSettings.mockResolvedValue({ site_owner_project_id: 7 })

    const { result } = renderHook(() => useUpdateSiteAdminSettings(), { wrapper })
    await result.current.mutateAsync({ site_owner_project_id: 7 })

    // r4 писал тело PUT целиком: `configured`, роль и `site_owner_active: false`
    // пропадали — кнопка уходила на догадку по JWT, выключенный владелец «оживал».
    expect(client.getQueryData(siteAdminKeys.settings())).toEqual(CACHED)
  })

  it('владелец сменился, PUT без полей о нём: прежние имя/активность/роль не переносятся', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(siteAdminKeys.settings(), { ...CACHED })
    siteAdminApiMock.updateSiteAdminSettings.mockResolvedValue({ site_owner_project_id: 9 })

    const { result } = renderHook(() => useUpdateSiteAdminSettings(), { wrapper })
    await result.current.mutateAsync({ site_owner_project_id: 9 })

    const cached = client.getQueryData<SiteAdminSettings>(siteAdminKeys.settings())
    expect(cached?.site_owner_project_id).toBe(9)
    // Настройка стенда, а не владельца — остаётся.
    expect(cached?.configured).toBe(true)
    // Имя, «выключен» и роль были про проект 7: на проекте 9 они были бы ложью
    // (чужое имя, отметка «выключен» у живого, кнопка по чужой роли).
    expect(cached).not.toHaveProperty('site_owner_project_name')
    expect(cached).not.toHaveProperty('site_owner_active')
    expect(cached).not.toHaveProperty('current_user_site_role')
  })

  it('присланное побеждает кэш, в том числе `null` и `false`', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(siteAdminKeys.settings(), { ...CACHED, site_owner_active: true })
    siteAdminApiMock.updateSiteAdminSettings.mockResolvedValue({
      site_owner_project_id: 7,
      site_owner_active: false,
      configured: false,
      current_user_site_role: null,
    })

    const { result } = renderHook(() => useUpdateSiteAdminSettings(), { wrapper })
    await result.current.mutateAsync({ site_owner_project_id: 7 })

    expect(client.getQueryData(siteAdminKeys.settings())).toEqual({
      ...CACHED,
      site_owner_active: false,
      configured: false,
      current_user_site_role: null,
    })
  })

  it('кэша ещё нет — в него ложится ответ PUT как есть', async () => {
    const { client, wrapper } = setup()
    siteAdminApiMock.updateSiteAdminSettings.mockResolvedValue({ site_owner_project_id: 9 })

    const { result } = renderHook(() => useUpdateSiteAdminSettings(), { wrapper })
    await result.current.mutateAsync({ site_owner_project_id: 9 })

    expect(client.getQueryData(siteAdminKeys.settings())).toEqual({ site_owner_project_id: 9 })
  })

  it('после сохранения настройки перечитываются — последнее слово за GET', async () => {
    const { wrapper, invalidateSpy } = setup()
    const truth: SiteAdminSettings = {
      site_owner_project_id: 9,
      site_owner_project_name: 'Second Project Beta',
      site_owner_active: true,
      configured: true,
      current_user_site_role: null,
    }
    siteAdminApiMock.getSiteAdminSettings
      .mockResolvedValueOnce({ ...CACHED })
      .mockResolvedValueOnce(truth)
    siteAdminApiMock.updateSiteAdminSettings.mockResolvedValue({ site_owner_project_id: 9 })

    const { result } = renderHook(
      () => ({ settings: useSiteAdminSettings(), update: useUpdateSiteAdminSettings() }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.settings.data).toEqual(CACHED))

    await result.current.update.mutateAsync({ site_owner_project_id: 9 })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: siteAdminKeys.settings() })
    await waitFor(() => expect(result.current.settings.data).toEqual(truth))
    expect(siteAdminApiMock.getSiteAdminSettings).toHaveBeenCalledTimes(2)
  })
})

describe('useOwnerProjectChoices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('сигнал отмены React Query доходит до запроса страницы проектов', async () => {
    const { wrapper } = setup()
    getProjectsMock.mockImplementation(async (params: ProjectListParams) =>
      page([1, 2], 1, params.page ?? 1)
    )

    const { result } = renderHook(() => useOwnerProjectChoices(true), { wrapper })
    await waitFor(() => expect(result.current.data?.projects).toHaveLength(2))

    expect(getProjectsMock).toHaveBeenCalledTimes(1)
    const [params, config] = getProjectsMock.mock.calls[0]
    expect(params).toEqual({ page: 1, page_size: 100, status: 'active' })
    expect(config?.signal).toBeInstanceOf(AbortSignal)
  })

  it('упала первая страница — запрос в ошибке, данных нет (экран скажет об этом)', async () => {
    const { wrapper } = setup()
    getProjectsMock.mockRejectedValue(new Error('403'))

    const { result } = renderHook(() => useOwnerProjectChoices(true), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it('неполный список (сбой страницы) не держится свежим: следующее открытие дочитает', async () => {
    const { wrapper } = setup()
    getProjectsMock.mockImplementation(async (params: ProjectListParams) => {
      if (params.page === 2) throw new Error('gateway 503')
      return page([1, 2], 3, params.page ?? 1)
    })

    const { result } = renderHook(() => useOwnerProjectChoices(true), { wrapper })
    await waitFor(() => expect(result.current.data?.truncated).toBe(true))
    expect(result.current.isStale).toBe(true)
  })

  it('контроль: полный список свеж пять минут — лишнего обхода нет', async () => {
    const { wrapper } = setup()
    getProjectsMock.mockImplementation(async (params: ProjectListParams) =>
      page([1, 2], 1, params.page ?? 1)
    )

    const { result } = renderHook(() => useOwnerProjectChoices(true), { wrapper })
    await waitFor(() => expect(result.current.data?.truncated).toBe(false))
    expect(result.current.isStale).toBe(false)
  })

  it('без права менять владельца — ни одного запроса', () => {
    const { wrapper } = setup()
    renderHook(() => useOwnerProjectChoices(false), { wrapper })
    expect(getProjectsMock).not.toHaveBeenCalled()
    expect(OWNER_CHOICES_MAX_PAGES).toBeGreaterThan(1)
  })
})
