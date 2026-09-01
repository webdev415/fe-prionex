/**
 * Хуки админского раздела «Память».
 *
 * Двойной гейт (право + аутентификация) — как в {@link useAssistantOverview}:
 * секция и так под PermissionGuard, но без `enabled` запрос успевает уйти в
 * гонке рендера и вернуть 403.
 *
 * Записи скоупа тянутся лениво — только когда строка таблицы раскрыта: у
 * кол-центра сотни скоупов, и грузить их все ради свёрнутой таблицы незачем.
 *
 * Удаление оптимистично внутри раскрытого скоупа (строка исчезает сразу,
 * ошибка возвращает её), а сводка после этого инвалидируется — счётчик
 * «записей» обязан сойтись со списком, иначе админ видит 65 записей и 64
 * строки.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'

import {
  assistantMemoryScopeKey,
  assistantMemorySummaryKey,
  deleteAssistantMemoryRecord,
  getAssistantMemoryScope,
  getAssistantMemorySummary,
  type AssistantMemoryScopeDetail,
} from '../api/assistantMemoryService'

export function useAssistantMemorySummary() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasPermission = useHasPermission(PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS)

  return useQuery({
    queryKey: assistantMemorySummaryKey,
    queryFn: getAssistantMemorySummary,
    enabled: isAuthenticated && hasPermission,
    staleTime: 60_000,
    retry: false,
  })
}

/** `scope === null` — строка свёрнута, запрос не уходит. */
export function useAssistantMemoryScope(scope: string | null) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasPermission = useHasPermission(PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS)

  return useQuery({
    queryKey: assistantMemoryScopeKey(scope ?? ''),
    queryFn: () => getAssistantMemoryScope(scope as string),
    enabled: Boolean(scope) && isAuthenticated && hasPermission,
    staleTime: 60_000,
    retry: false,
  })
}

interface DeleteMemoryRecordVars {
  id: number
  /** Скоуп, из списка которого удаляют — нужен для точечного отката. */
  scope: string
}

export function useDeleteAssistantMemoryRecord() {
  const queryClient = useQueryClient()

  return useMutation<
    void,
    unknown,
    DeleteMemoryRecordVars,
    { previous?: AssistantMemoryScopeDetail }
  >({
    mutationFn: ({ id }) => deleteAssistantMemoryRecord(id),
    onMutate: async ({ id, scope }) => {
      const key = assistantMemoryScopeKey(scope)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<AssistantMemoryScopeDetail>(key)

      if (previous) {
        const items = previous.items.filter((item) => item.id !== id)
        queryClient.setQueryData<AssistantMemoryScopeDetail>(key, {
          ...previous,
          items,
          total: Math.max(0, previous.total - (previous.items.length - items.length)),
        })
      }

      return { previous }
    },
    onError: (_error, { scope }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(assistantMemoryScopeKey(scope), context.previous)
      }
    },
    onSettled: (_data, _error, { scope }) => {
      void queryClient.invalidateQueries({ queryKey: assistantMemoryScopeKey(scope) })
      void queryClient.invalidateQueries({ queryKey: assistantMemorySummaryKey })
    },
  })
}
