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
 * Создание из формы (a2) — иначе: ключ живёт на действие с НЕИЗМЕННЫМ телом
 * (модуль кладёт тело в отпечаток ключа; см. `useSaveCreditPostbackRule`).
 */
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { newIdempotencyKey } from '../api/creditApi'
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

type SaveCallbacks = { onSuccess: () => void; onError: (error: Error) => void }

/**
 * Сохранение формы правила: без `ruleId` — создание, с ним — правка.
 *
 * Ключ создания (Р-18-13d-9) минтится при открытии формы (монтаж хука) и живёт,
 * пока тело не меняется: повтор неизменённого тела после сетевого отказа несёт
 * тот же ключ — модуль отдаст первый ответ, дубля правила не будет. Ключ, уже
 * ушедший с одним телом, с другим не годится (модуль ответит 409), поэтому
 * любая правка поля после отправки (`edited`) минтит новый. Правка (PATCH) —
 * ключ на нажатие, как у вкл/выкл.
 */
export function useSaveCreditPostbackRule(ruleId?: string) {
  const queryClient = useQueryClient()
  const [createKey, setCreateKey] = useState(() => newIdempotencyKey('fe-postback-rule'))
  const keySent = useRef(false)
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
    save: (body: CreditPostbackRulePatch, callbacks: SaveCallbacks) => {
      keySent.current = !ruleId
      const key = ruleId ? newIdempotencyKey('fe-postback-rule') : createKey
      mutation.mutate({ body, key }, callbacks)
    },
    edited: () => {
      if (!keySent.current) return
      keySent.current = false
      setCreateKey(newIdempotencyKey('fe-postback-rule'))
    },
    isPending: mutation.isPending,
  }
}
