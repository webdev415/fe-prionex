/**
 * Список правил постбеков партнерам (18-13d-a1).
 *
 * Вкл/выкл — одним нажатием: обратимо и видно в списке (Р-18-13d-8). Удаление
 * необратимо — только через подтверждение. Без права записи переключатели
 * выключены, кнопки удаления в разметке нет. Форма создания и правки — a2.
 *
 * Адрес правила часто несёт токен партнёра (Р-18-13d-11): ячейка под замазкой
 * записи сессий, полный адрес — в подсказке (`PiiTooltip`, текст тоже под
 * замазкой) и в кнопке копирования. В атрибуты (`title`) адрес не кладётся:
 * запись их не замазывает.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PiiTooltip } from '@/components/ui/PiiTooltip'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { formatDateTime } from '@/lib/formatters'
import { isKnownPostbackTrigger, type CreditPostbackRule } from '@/features/credit/api/postbacks'
import {
  useDeleteCreditPostbackRule,
  useToggleCreditPostbackRule,
} from '@/features/credit/hooks/useCreditPostbacks'
import { CopyButton } from './CreditCardHeader'

/** Видимая часть адреса; целиком — в подсказке и копированием. */
const URL_VISIBLE = 48

function shortUrl(url: string): string {
  return url.length > URL_VISIBLE ? `${url.slice(0, URL_VISIBLE - 1)}…` : url
}

export function CreditPostbackRulesTable({
  rules,
  canWrite,
}: {
  rules: CreditPostbackRule[]
  canWrite: boolean
}) {
  const { t } = useTranslation('common')
  const toggle = useToggleCreditPostbackRule()
  const remove = useDeleteCreditPostbackRule()
  const [confirming, setConfirming] = useState<CreditPostbackRule | null>(null)

  const columns: Column<CreditPostbackRule>[] = [
    { key: 'name', header: t('credit.postbacks.rules.name'), render: (rule) => rule.name },
    {
      key: 'trigger',
      header: t('credit.postbacks.rules.trigger'),
      // Код вне снимка контракта — как есть, с пометкой: экран не падает.
      render: (rule) =>
        isKnownPostbackTrigger(rule.trigger) ? (
          t(`credit.postbacks.trigger.${rule.trigger}`)
        ) : (
          <span>
            <span className="font-mono text-xs">{rule.trigger}</span>{' '}
            <span className="text-muted-foreground text-xs">
              ({t('credit.postbacks.unknownValue')})
            </span>
          </span>
        ),
    },
    { key: 'utm_source', header: 'utm_source', render: (rule) => rule.utm_source },
    {
      key: 'url',
      header: t('credit.postbacks.rules.url'),
      obscured: true,
      render: (rule) => (
        <span className="inline-flex items-center gap-1">
          <PiiTooltip label={rule.url_template}>
            <span className="font-mono text-xs">{shortUrl(rule.url_template)}</span>
          </PiiTooltip>
          <CopyButton value={rule.url_template} label={t('credit.postbacks.rules.copyUrl')} />
        </span>
      ),
    },
    { key: 'goal', header: t('credit.postbacks.rules.goal'), render: (rule) => rule.goal ?? '—' },
    {
      key: 'currency',
      header: t('credit.postbacks.rules.currency'),
      render: (rule) => rule.currency ?? '—',
    },
    {
      key: 'active',
      header: t('credit.postbacks.rules.active'),
      render: (rule) => (
        <ToggleSwitch
          // На время запроса — новое положение; отказ вернёт прежнее из кэша.
          checked={toggle.pending?.id === rule.id ? toggle.pending.active : rule.active}
          onChange={(active) => toggle.run({ id: rule.id, active })}
          disabled={!canWrite || toggle.isPending}
          ariaLabel={t('credit.postbacks.rules.toggle', { name: rule.name })}
        />
      ),
    },
    {
      key: 'updated_at',
      header: t('credit.postbacks.rules.updatedAt'),
      render: (rule) => formatDateTime(rule.updated_at),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">{t('credit.postbacks.rules.actions')}</span>,
            align: 'right' as const,
            render: (rule: CreditPostbackRule) => (
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => setConfirming(rule)}
              >
                {t('credit.postbacks.rules.delete')}
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      {toggle.error && (
        <Alert variant="error" className="mb-3">
          {t('credit.postbacks.rules.toggleFailed')}
        </Alert>
      )}
      {remove.error && (
        <Alert variant="error" className="mb-3">
          {t('credit.postbacks.rules.deleteFailed')}
        </Alert>
      )}
      <DataTable columns={columns} data={rules} emptyMessage={t('credit.postbacks.rules.empty')} />
      <ConfirmDialog
        open={confirming !== null}
        tone="danger"
        title={t('credit.postbacks.rules.deleteTitle', { name: confirming?.name ?? '' })}
        message={t('credit.postbacks.rules.deleteMessage')}
        confirmLabel={t('credit.postbacks.rules.delete')}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) remove.run({ id: confirming.id })
          setConfirming(null)
        }}
      />
    </>
  )
}

export default CreditPostbackRulesTable
