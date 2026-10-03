/**
 * Хуки постбеков партнерам (18-13d) — рядом с транспортом `api/postbacks.ts`,
 * по раскладке `useCreditCommunications.ts`.
 *
 * Ключ идемпотентности — НА НАЖАТИЕ (Р-18-13d-9). Он минтится в `run` и едет в
 * переменных мутации, а не выпускается в `mutationFn`: любой повтор того же
 * действия (ручной `mutate` с теми же переменными, будущий автоповтор) несёт тот
 * же ключ — модуль отдаёт первый ответ и не выполняет действие дважды. Второе
 * нажатие — новое действие и новый ключ. Глобальный автоповтор мутаций
 * (`main.tsx`) сегодня `CreditApiError` не повторяет: транспорт раздела не
 * переносит `code` сетевого отказа axios, поэтому после моргнувшей сети оператор
 * видит отказ и нажимает ещё раз — уже с новым ключом.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { newIdempotencyKey } from '../api/creditApi'
import {
  creditPostbacksApi,
  type CreditPostbackRule,
  type CreditPostbackRuleList,
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

type RuleTarget = { id: string }

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
    isPending: mutation.isPending,
    pending: mutation.isPending ? mutation.variables?.vars : undefined,
    error: mutation.error,
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
