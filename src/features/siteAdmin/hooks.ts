/**
 * React Query хуки админки сайта (17-40b).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectsKeys } from '@/features/projects/hooks/useProjects'
import { siteAdminApi } from './api'
import { fetchOwnerProjectChoices, OWNER_CHOICES_PAGE_SIZE } from './ownerChoices'
import type { UpdateSiteAdminSettingsInput } from './types'

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

export function useUpdateSiteAdminSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateSiteAdminSettingsInput) =>
      siteAdminApi.updateSiteAdminSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(siteAdminKeys.settings(), data)
    },
    // Отказ (например, выбранный проект уже удалён) значит, что экран держит
    // устаревшую картину — перечитать её, а не спорить с ней.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: siteAdminKeys.settings() })
    },
  })
}

/**
 * Все активные проекты для выбора владельца (`ownerChoices.ts`), постранично.
 *
 * @param enabled — только у того, кто может сменить владельца: остальным выбор
 * показан выключенным, и обход страниц был бы лишним трафиком (r4).
 */
export function useOwnerProjectChoices(enabled: boolean) {
  return useQuery({
    queryKey: siteAdminKeys.ownerChoices(),
    queryFn: () => fetchOwnerProjectChoices(),
    enabled,
    staleTime: 5 * 60 * 1000,
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
