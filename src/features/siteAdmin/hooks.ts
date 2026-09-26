/**
 * React Query хуки админки сайта (17-40b).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProjects } from '@/features/projects/api/projectsApi'
import { projectsKeys } from '@/features/projects/hooks/useProjects'
import { siteAdminApi } from './api'
import { fetchOwnerProjectChoices, OWNER_CHOICES_PAGE_SIZE } from './ownerChoices'
import type { SiteAdminSettings, UpdateSiteAdminSettingsInput } from './types'

export const siteAdminKeys = {
  all: ['siteAdmin'] as const,
  settings: () => [...siteAdminKeys.all, 'settings'] as const,
  // Под списками проектов: создание, правка и архив проекта инвалидируют
  // `projectsKeys.lists()` — выбор владельца обновится вместе с ними.
  ownerChoices: () =>
    [...projectsKeys.lists(), 'siteOwnerChoices', OWNER_CHOICES_PAGE_SIZE] as const,
}

export function useSiteAdminSettings(enabled = true) {
  return useQuery({
    queryKey: siteAdminKeys.settings(),
    queryFn: () => siteAdminApi.getSiteAdminSettings(),
    enabled,
  })
}

/**
 * Ответ PUT поверх прочитанного GET (r5, P3 ревью).
 *
 * Поля ответа необязательны, и `undefined` у них значимо: нет роли — догадка по
 * JWT, нет `site_owner_active` — «владелец живой». Поэтому ответ не пишется в
 * кэш целиком: поле, которого в нём нет, остаётся из GET, присланное (и `null`,
 * и `false`) — побеждает. Исключение — поля о ПРЕЖНЕМ владельце: если PUT
 * сменил владельца, его имя, «выключен» и роль в нём про новый проект были бы
 * ложью, и их нет, пока их не скажет сервер (имя экран возьмёт из списка).
 * Последнее слово всё равно за GET: после сохранения настройки перечитываются.
 */
function mergeSavedSettings(
  cached: SiteAdminSettings | undefined,
  saved: SiteAdminSettings
): SiteAdminSettings {
  if (!cached) return saved
  const base: SiteAdminSettings = { ...cached }
  const ownerChanged =
    saved.site_owner_project_id !== undefined &&
    saved.site_owner_project_id !== cached.site_owner_project_id
  if (ownerChanged) {
    delete base.site_owner_project_name
    delete base.site_owner_active
    delete base.current_user_site_role
  }
  const present = Object.fromEntries(
    Object.entries(saved).filter(([, value]) => value !== undefined)
  ) as Partial<SiteAdminSettings>
  return { ...base, ...present }
}

export function useUpdateSiteAdminSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSiteAdminSettingsInput) =>
      siteAdminApi.updateSiteAdminSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData<SiteAdminSettings>(siteAdminKeys.settings(), (cached) =>
        mergeSavedSettings(cached, data)
      )
      void queryClient.invalidateQueries({ queryKey: siteAdminKeys.settings() })
    },
    // Отказ (например, выбранный проект уже удалён) значит, что экран держит
    // устаревшую картину — перечитать её, а не спорить с ней.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: siteAdminKeys.settings() })
    },
  })
}

const OWNER_CHOICES_FRESH_MS = 5 * 60 * 1000

/**
 * Все активные проекты для выбора владельца (`ownerChoices.ts`), постранично.
 *
 * Сигнал отмены React Query доходит до каждой страницы: закрытая вкладка
 * останавливает обход (r5). Неполный список (`truncated`: сбой страницы или
 * потолок) свежим не считается — следующее открытие вкладки прочитает заново,
 * а не покажет тот же обрывок ещё пять минут.
 *
 * @param enabled — только у того, кто может сменить владельца: остальным выбор
 * показан выключенным, и обход страниц был бы лишним трафиком (r4).
 */
export function useOwnerProjectChoices(enabled: boolean) {
  return useQuery({
    queryKey: siteAdminKeys.ownerChoices(),
    queryFn: ({ signal }) => fetchOwnerProjectChoices(getProjects, signal),
    enabled,
    staleTime: (query) => (query.state.data?.truncated ? 0 : OWNER_CHOICES_FRESH_MS),
  })
}

/**
 * Ключ входа — не данные для кэша: одноразовый и живёт минуту.
 *
 * Результат мутации React Query хранит в `MutationCache` (`data`), пока
 * компонент смонтирован, и ещё `gcTime` после. Поэтому `gcTime: 0` здесь, а
 * экран зовёт `reset()` сразу после `safeHttpUrl`, до перехода вкладки (так
 * сброс случается и на негодном адресе) — ключ в памяти страницы не
 * задерживается. Вкладку экран открывает сам, в нажатии, ДО запроса (r4):
 * окно, открытое после ответа, браузер блокирует молча; вкладку не дали —
 * уходит по адресу этой вкладкой (r4b). `retry: false`: повтор выпустил бы
 * второй ключ за одно нажатие; повтор — это новое нажатие.
 *
 * На отказе перечитываются настройки: 403/409/503 значат, что экран показал
 * кнопку по устаревшей картине, и новая скажет человеку правду без нажатия.
 * Если и перечитать не удалось, экран держит прежнюю картину (r3, D-2).
 */
export function useSiteAdminHandoff() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => siteAdminApi.requestSiteAdminHandoff(),
    gcTime: 0,
    retry: false,
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: siteAdminKeys.settings() })
    },
  })
}
