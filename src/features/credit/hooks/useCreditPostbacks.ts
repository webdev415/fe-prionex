/**
 * Хуки постбеков партнерам (18-13d) — рядом с транспортом `api/postbacks.ts`,
 * по раскладке `useCreditCommunications.ts`.
 *
 * Ключ идемпотентности — НА НАЖАТИЕ (Р-18-13d-9). Он минтится в `run` и едет в
 * переменных мутации, а не выпускается в `mutationFn`: любой повтор того же
 * действия (ручной `mutate` с теми же переменными, будущий автоповтор) несёт тот
 * же ключ — модуль отдаёт первый ответ и не выполняет действие дважды. Второе
 * нажатие — новое действие и новый ключ. Глобальный автоповтор мутаций
 * (`main.tsx`) повторяет сетевой отказ (`transportCode` у `CreditApiError`) один
 * раз — с теми же переменными мутации, значит с тем же ключом.
 *
 * Создание из формы (a2) — иначе: ключ живёт на открытие формы и меняется только
 * после определённого отказа (см. `useSaveCreditPostbackRule`).
 */
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditApiError, newIdempotencyKey } from '../api/creditApi'
import {
  creditPostbacksApi,
  type CreditPostbackRule,
  type CreditPostbackRuleInput,
  type CreditPostbackRuleList,
  type CreditPostbackRulePatch,
} from '../api/postbacks'

export const creditPostbackKeys = {
  all: ['credit', 'postbacks'] as const,
  rules: () => [...creditPostbackKeys.all, 'rules'] as const,
}

export function useCreditPostbackRules() {
  return useQuery({
    queryKey: creditPostbackKeys.rules(),
    queryFn: () => creditPostbacksApi.rules(),
    retry: false,
  })
}

/** Имя едет в переменных мутации — им баннер отказа называет правило. */
type RuleTarget = { id: string; name: string }

/**
 * Ответ двери сразу кладётся в кэш (без мигания старым значением), затем список
 * перечитывается — без ожидания: промис из `onSettled` TanStack Query ждёт, и
 * мутация висела бы `isPending` до конца GET (при отказе — неприменённое
 * положение переключателя и ни слова об отказе, пока висит перечитка).
 */
function useRuleMutation<V extends RuleTarget>(
  send: (vars: V, key: string) => Promise<CreditPostbackRule>,
  apply: (items: CreditPostbackRule[], rule: CreditPostbackRule, vars: V) => CreditPostbackRule[]
) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ vars, key }: { vars: V; key: string }) => send(vars, key),
    onSuccess: (rule, { vars }) => {
      queryClient.setQueryData<CreditPostbackRuleList>(creditPostbackKeys.rules(), (list) =>
        list ? { ...list, items: apply(list.items, rule, vars) } : list
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: creditPostbackKeys.rules() })
    },
  })
  return {
    run: (vars: V) => mutation.mutate({ vars, key: newIdempotencyKey('fe-postback-rule') }),
    /**
     * Снять показанный отказ прошлого нажатия (старт другого действия). Идущий
     * запрос не трогается: `reset()` TanStack отвязал бы от него наблюдатель —
     * пропали бы `isPending` (защита строки) и отказ, который ещё придёт.
     */
    reset: () => {
      if (mutation.isError) mutation.reset()
    },
    isPending: mutation.isPending,
    pending: mutation.isPending ? mutation.variables?.vars : undefined,
    error: mutation.error,
    failed: mutation.isError ? mutation.variables?.vars : undefined,
  }
}

/** Вкл/выкл: `PATCH {active}`; при отказе экран показывает прежнее положение из кэша. */
export function useToggleCreditPostbackRule() {
  return useRuleMutation<RuleTarget & { active: boolean }>(
    ({ id, active }, key) => creditPostbacksApi.updateRule(id, { active }, key),
    (items, rule) => items.map((item) => (item.id === rule.id ? rule : item))
  )
}

export function useDeleteCreditPostbackRule() {
  return useRuleMutation<RuleTarget>(
    ({ id }, key) => creditPostbacksApi.deleteRule(id, key),
    (items, _rule, { id }) => items.filter((item) => item.id !== id)
  )
}

/**
 * Определённый отказ — ответ 4xx, кроме 408 и 429: модуль правило не создал.
 * Нет ответа (сеть, таймаут), 5xx, 408, 429 — исход неизвестен. Копия
 * `isSettledRefusal` из `useCredit.ts` (там она не экспортируется).
 */
function isSettledRefusal(error: unknown): boolean {
  if (!(error instanceof CreditApiError) || error.status === undefined) return false
  return error.status < 500 && error.status !== 408 && error.status !== 429
}

/** `unsettled` — у создания с открытия формы был неизвестный исход: правило могло появиться. */
type SaveCallbacks = { onSuccess: () => void; onError: (error: Error, unsettled: boolean) => void }

/**
 * Сохранение формы правила: без `ruleId` — создание, с ним — правка.
 *
 * Ключ создания (Р-18-13d-9) минтится при открытии формы (монтаж хука). Модуль
 * кладёт тело в отпечаток ключа: тот же ключ с тем же телом — первый ответ, с
 * другим — 409 `idempotency_key_reused`. Отсюда два случая:
 *  - определённый отказ (422, 409, 403…) — правила нет; правка поля после него
 *    (`edited`) — новое действие и новый ключ;
 *  - исход неизвестен (нет ответа, 5xx, 408, 429) — модуль мог правило создать,
 *    поэтому ключ держится до закрытия формы, даже после следующих определённых
 *    отказов (422 схемы модуль отдаёт раньше сверки ключа): повтор либо создаст
 *    правило, либо получит первый ответ или 409 — второго правила не будет
 *    (ревью бота, Б-1).
 * Правка (PATCH) — ключ на нажатие, как у вкл/выкл.
 */
export function useSaveCreditPostbackRule(ruleId?: string) {
  const queryClient = useQueryClient()
  const [createKey, setCreateKey] = useState(() => newIdempotencyKey('fe-postback-rule'))
  const keyRefused = useRef(false)
  const unsettled = useRef(false)
  const mutation = useMutation({
    mutationFn: ({ body, key }: { body: CreditPostbackRulePatch; key: string }) =>
      ruleId
        ? creditPostbacksApi.updateRule(ruleId, body, key)
        : creditPostbacksApi.createRule(body as CreditPostbackRuleInput, key),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: creditPostbackKeys.rules() })
    },
  })
  return {
    save: (body: CreditPostbackRulePatch, { onSuccess, onError }: SaveCallbacks) => {
      keyRefused.current = false
      const key = ruleId ? newIdempotencyKey('fe-postback-rule') : createKey
      const refused = (error: Error) => {
        if (!ruleId && !isSettledRefusal(error)) unsettled.current = true
        keyRefused.current = !ruleId && !unsettled.current
        onError(error, unsettled.current)
      }
      mutation.mutate({ body, key }, { onSuccess, onError: refused })
    },
    edited: () => {
      if (!keyRefused.current) return
      keyRefused.current = false
      setCreateKey(newIdempotencyKey('fe-postback-rule'))
    },
    isPending: mutation.isPending,
  }
}
