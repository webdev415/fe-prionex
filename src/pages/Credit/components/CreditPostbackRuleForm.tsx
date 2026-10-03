/**
 * Форма правила постбека партнёру — создание и правка (18-13d-a2, CAP-31).
 *
 * Сервер — источник правды по правилу (Р-18-13d-6): клиент повторяет три
 * проверки модуля (`checkPostbackUrl`) лишь затем, чтобы не гонять запрос
 * впустую; всё прочее решает 422 модуля, и его отказы раскладываются по полям
 * (`errors[].field` → поле, уточнение — `details.reason`).
 *
 * Макросы — подсказка и вставка в позицию курсора; значений на клиенте никто не
 * подставляет (Р-18-13d-7): итоговый адрес собирает модуль, его видно в логе.
 * Адрес часто несёт токен партнёра — поле под замазкой записи сессий вместе с
 * текстом своей ошибки (в нём имена чужих макросов — куски адреса).
 *
 * Пока запрос в пути, форма выключена: правка после «Зберегти» не ушла бы в
 * запрос и пропала бы при закрытии по успеху.
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { piiProps } from '@/lib/openreplay/pii'
import { CreditApiError } from '@/features/credit/api/creditApi'
import {
  isKnownPostbackMacro,
  isKnownPostbackRuleReason,
} from '@/features/credit/api/postbackEnums'
import {
  checkPostbackUrl,
  isKnownPostbackTrigger,
  type CreditPostbackRule,
  type CreditPostbackRuleInput,
  type CreditPostbackRuleList,
  type CreditPostbackRulePatch,
  type PostbackUrlProblem,
} from '@/features/credit/api/postbacks'
import { useSaveCreditPostbackRule } from '@/features/credit/hooks/useCreditPostbacks'

/** Поля формы, на которые модуль кладёт отказ (`errors[].field`). */
const FIELDS = ['name', 'trigger', 'utm_source', 'url_template', 'goal', 'currency'] as const
type Field = (typeof FIELDS)[number]
type Draft = Record<Field, string> & { active: boolean }
type Refusal = { fields: Partial<Record<Field, string>>; general?: string; unsettled?: boolean }

/** Пример адреса из ТЗ — только текст подсказки. */
const EXAMPLE_URL =
  'https://partner.com/postback?clickid={click_id}&action_id={action_id}&goal={goal}&sum={amount}&currency={currency}'

function draftOf(rule?: CreditPostbackRule): Draft {
  return {
    name: rule?.name ?? '',
    active: rule?.active ?? true,
    trigger: rule?.trigger ?? '',
    utm_source: rule?.utm_source ?? '',
    url_template: rule?.url_template ?? '',
    goal: rule?.goal ?? '',
    currency: rule?.currency ?? '',
  }
}

/** Тело двери: края имени и `utm_source` срезаются, пустые goal и валюта — их отсутствие. */
function bodyOf(draft: Draft): CreditPostbackRuleInput {
  return {
    ...draft,
    name: draft.name.trim(),
    utm_source: draft.utm_source.trim(),
    goal: draft.goal.trim() || null,
    currency: draft.currency.trim() || null,
  }
}

/** Правка шлёт только изменённые поля — сравнение по телу двери, после среза краёв. */
function changedOf(body: CreditPostbackRuleInput, rule: CreditPostbackRule) {
  const keys = Object.keys(body) as Array<keyof CreditPostbackRuleInput>
  return Object.fromEntries(
    keys.filter((key) => body[key] !== rule[key]).map((key) => [key, body[key]])
  ) as CreditPostbackRulePatch
}

export function CreditPostbackRuleForm({
  rule,
  list,
  onClose,
  onConflict,
}: {
  /** Нет — создание. */
  rule?: CreditPostbackRule
  list: CreditPostbackRuleList
  onClose: () => void
  /** 409 правки: копия правила устарела — форма закрывается, раздел называет правило. */
  onConflict: (name: string) => void
}) {
  const { t } = useTranslation('common')
  const save = useSaveCreditPostbackRule(rule?.id)
  const [draft, setDraft] = useState(() => draftOf(rule))
  const [refusal, setRefusal] = useState<Refusal>({ fields: {} })
  const urlRef = useRef<HTMLInputElement>(null)

  const reasonText = (reason: string) =>
    isKnownPostbackRuleReason(reason) ? t(`credit.postbacks.form.errors.${reason}`) : null
  const problemText = (problem: PostbackUrlProblem) =>
    problem.reason === 'url_macro_unknown' && problem.macros.length > 0
      ? `${t('credit.postbacks.form.errors.url_macro_unknown')} ${problem.macros.join(', ')}`
      : t(`credit.postbacks.form.errors.${problem.reason}`)

  /**
   * Правка поля снимает общий отказ и отказ модуля с этого поля; ключ создания
   * меняет хук (только после определённого отказа). Предупреждение о неизвестном
   * исходе остаётся: исход и после правки неизвестен.
   */
  const edit = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setRefusal((current) => ({
      ...current,
      general: undefined,
      fields: Object.fromEntries(
        Object.entries(current.fields).filter(([field]) => !(field in patch))
      ),
    }))
    save.edited()
  }

  const insertMacro = (macro: string) => {
    const input = urlRef.current
    const value = draft.url_template
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? start
    const token = `{${macro}}`
    edit({ url_template: value.slice(0, start) + token + value.slice(end) })
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const refusalOf = (error: Error): Refusal => {
    const failure = error instanceof CreditApiError ? error : undefined
    // Тот же ключ с другим телом: прошлая попытка с неизвестным исходом могла создать правило.
    if (failure?.status === 409 && failure.code === 'idempotency_key_reused')
      return { fields: {}, general: t('credit.postbacks.form.mayExist') }
    if (failure?.status !== 422)
      return { fields: {}, general: t('credit.postbacks.form.saveFailed') }
    const reasons = (failure.details?.reason ?? {}) as Record<string, unknown>
    const next: Refusal = { fields: {} }
    for (const { field } of failure.fields ?? []) {
      if (!field || !(FIELDS as readonly string[]).includes(field)) {
        next.general = failure.message
        continue
      }
      const codes = Array.isArray(reasons[field]) ? (reasons[field] as unknown[]) : []
      const texts = codes.map((code) => reasonText(String(code)) ?? failure.message)
      next.fields[field as Field] =
        texts.length > 0 ? [...new Set(texts)].join(' ') : failure.message
    }
    if (!failure.fields?.length) next.general = failure.message
    return next
  }

  const body = bodyOf(draft)
  const patch = rule ? changedOf(body, rule) : body
  const problems = draft.url_template
    ? checkPostbackUrl(draft.url_template, draft.trigger, list)
    : []
  const urlError = [...problems.map(problemText), refusal.fields.url_template].filter(Boolean)
  const complete = Boolean(
    draft.name.trim() && draft.trigger && body.utm_source && draft.url_template
  )
  const canSave =
    complete && problems.length === 0 && !save.isPending && Object.keys(patch).length > 0

  const close = () => {
    if (!save.isPending) onClose()
  }

  const submit = () => {
    setRefusal({ fields: {} })
    save.save(patch, {
      onSuccess: onClose,
      onError: (error, unsettled) => {
        if (rule && error instanceof CreditApiError && error.status === 409) onConflict(rule.name)
        else setRefusal({ ...refusalOf(error), unsettled })
      },
    })
  }

  const triggerLabel = (code: string) =>
    isKnownPostbackTrigger(code)
      ? t(`credit.postbacks.trigger.${code}`)
      : `${code} (${t('credit.postbacks.unknownValue')})`
  const triggers = list.triggers.map((item) => item.code)
  if (rule && !triggers.includes(rule.trigger)) triggers.push(rule.trigger)

  return (
    <Modal open onClose={close} maxWidth="xl" preventOutsideClose>
      <ModalHeader
        title={rule ? t('credit.postbacks.form.editTitle') : t('credit.postbacks.form.createTitle')}
      />
      <ModalContent>
        <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
          {refusal.general && <Alert variant="error">{refusal.general}</Alert>}
          <Input
            label={t('credit.postbacks.rules.name')}
            value={draft.name}
            onChange={(event) => edit({ name: event.target.value })}
            error={refusal.fields.name}
          />
          <div className="flex items-center gap-3 text-sm">
            <ToggleSwitch
              checked={draft.active}
              onChange={(active) => edit({ active })}
              ariaLabel={t('credit.postbacks.rules.active')}
            />
            {t('credit.postbacks.rules.active')}
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            {t('credit.postbacks.rules.trigger')}
            <select
              className="border-input-border bg-card text-foreground h-10 rounded-md border px-3 text-sm"
              value={draft.trigger}
              onChange={(event) => edit({ trigger: event.target.value })}
            >
              <option value="">{t('credit.postbacks.form.chooseTrigger')}</option>
              {triggers.map((code) => (
                <option key={code} value={code}>
                  {triggerLabel(code)}
                </option>
              ))}
            </select>
            {refusal.fields.trigger && (
              <span className="text-error-500 text-xs" role="alert">
                {refusal.fields.trigger}
              </span>
            )}
          </label>
          <Input
            label="utm_source"
            value={draft.utm_source}
            onChange={(event) => edit({ utm_source: event.target.value })}
            error={refusal.fields.utm_source}
          />
          <div {...piiProps} className="space-y-4">
            <Input
              {...piiProps}
              ref={urlRef}
              label={t('credit.postbacks.rules.url')}
              value={draft.url_template}
              onChange={(event) => edit({ url_template: event.target.value })}
              error={urlError.length > 0 ? urlError.join(' ') : undefined}
            />
            <div className="text-muted-foreground space-y-1 text-xs">
              <p>{t('credit.postbacks.form.macrosHint')}</p>
              <ul className="space-y-1">
                {list.macros.map((macro) => (
                  <li key={macro} className="flex flex-wrap items-center gap-2">
                    <Button size="xs" variant="outline" onClick={() => insertMacro(macro)}>
                      {`{${macro}}`}
                    </Button>
                    <span>
                      {isKnownPostbackMacro(macro)
                        ? t(`credit.postbacks.macro.${macro}`)
                        : t('credit.postbacks.unknownValue')}
                      {macro === 'click_id' && ` — ${t('credit.postbacks.form.macroRequired')}`}
                      {macro === 'amount' && ` — ${t('credit.postbacks.form.macroAmountOnly')}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p>
                {t('credit.postbacks.form.example')}{' '}
                <code className="break-all">{EXAMPLE_URL}</code>
              </p>
            </div>
          </div>
          <Input
            label={t('credit.postbacks.rules.goal')}
            value={draft.goal}
            onChange={(event) => edit({ goal: event.target.value })}
            helperText={t('credit.postbacks.form.goalHint')}
            error={refusal.fields.goal}
          />
          <Input
            label={t('credit.postbacks.rules.currency')}
            value={draft.currency}
            onChange={(event) => edit({ currency: event.target.value })}
            helperText={t('credit.postbacks.form.currencyHint')}
            error={refusal.fields.currency}
          />
        </fieldset>
        {refusal.unsettled && (
          <Alert variant="warning" role="status" className="mt-4">
            {t('credit.postbacks.form.outcomeUnknown')}
          </Alert>
        )}
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={close} disabled={save.isPending}>
          {t('credit.postbacks.form.cancel')}
        </Button>
        <Button disabled={!canSave} isLoading={save.isPending} onClick={submit}>
          {t('credit.postbacks.form.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CreditPostbackRuleForm
