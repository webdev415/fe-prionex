import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useClientCallSummary } from '@/features/dialer'
import type { CallSummaryLoan } from '@/features/dialer'
import {
  useCreateInteraction,
  useInteractionTypes,
} from '@/features/clients/hooks/useNoteInteraction'
import { Icons } from '@/lib/icons'
import { uiLocale, withCurrency } from '@/lib/formatters'
import { piiProps } from '@/lib/openreplay/pii'

interface CallInteractionFormProps {
  clientId: number
  clientName: string
  phone: string
}

function LoanFactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  )
}

function LoanCard({ loan }: { loan: CallSummaryLoan }) {
  const { t } = useTranslation('common')
  const money = (n: number) => {
    const text = n.toLocaleString(uiLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return withCurrency(text, 'tight')
  }
  return (
    <div className="border-border bg-muted/30 rounded-lg border p-4">
      <LoanFactRow label={t('dialer.call.loanNumber', 'Number')} value={loan.number} />
      <LoanFactRow
        label={t('dialer.call.loanCounterparty', 'Counterparty')}
        value={loan.counterparty}
      />
      <LoanFactRow
        label={t('dialer.call.loanDateOfSale', 'Date of Sale')}
        value={loan.date_of_sale ? new Date(loan.date_of_sale).toLocaleDateString() : '—'}
      />
      <LoanFactRow
        label={t('dialer.call.loanBodyAmount', 'Body Amount')}
        value={money(loan.body_amount)}
      />
      <LoanFactRow
        label={t('dialer.call.loanTotalToReturn', 'Total to Return')}
        value={money(loan.total_to_return)}
      />
      <LoanFactRow
        label={t('dialer.call.loanLegitimate', 'Legitimate')}
        value={money(loan.legitimate)}
      />
    </div>
  )
}

export function CallInteractionForm({ clientId, clientName, phone }: CallInteractionFormProps) {
  const { t } = useTranslation('common')
  const { data: summary } = useClientCallSummary(clientId)
  const { data: types } = useInteractionTypes()
  const createInteraction = useCreateInteraction()

  const [typeId, setTypeId] = useState<number | undefined>(undefined)
  const [comment, setComment] = useState('')

  const defaultTypeId = useMemo(
    () => types?.find((it) => it.code === 'OUTGOING')?.id ?? types?.[0]?.id,
    [types]
  )
  const resolvedTypeId = typeId ?? defaultTypeId

  const handleSubmit = async () => {
    if (!resolvedTypeId) {
      toast.error(t('dialer.call.selectTypeRequired', 'Please select an interaction type'))
      return
    }
    try {
      await createInteraction.mutateAsync({
        clientId,
        data: {
          type_id: resolvedTypeId,
          phone_used: phone,
          summary: comment || undefined,
        },
      })
      toast.success(t('dialer.call.interactionSaved', 'Interaction saved'))
      setComment('')
    } catch {
      void 0
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          {t('dialer.call.clientName', "Client's Name")}
        </label>
        <div
          className="border-border bg-muted/40 text-foreground rounded-lg border px-3 py-2 text-sm"
          {...piiProps}
        >
          {clientName}
        </div>
        {summary?.tags && summary.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.tags.map((tag) => (
              <span
                key={tag}
                className="border-border bg-card text-foreground rounded-full border px-2.5 py-0.5 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-muted-foreground mb-1 block text-xs">
          {t('dialer.call.taxId', 'Tax ID')}
        </label>
        <div className="border-border bg-muted/40 text-foreground rounded-lg border px-3 py-2 text-sm">
          {summary?.tax_id ?? '—'}
        </div>
      </div>

      <div>
        <label
          className="text-muted-foreground mb-1 block text-xs"
          htmlFor="dialer-interaction-type"
        >
          {t('dialer.call.interactionType', 'Interaction Type')}
        </label>
        <Select
          value={resolvedTypeId?.toString()}
          onValueChange={(value) => setTypeId(Number(value))}
        >
          <SelectTrigger
            className="w-full"
            id="dialer-interaction-type"
            aria-label={t('dialer.call.interactionType', 'Interaction Type')}
          >
            <SelectValue placeholder={t('dialer.call.selectType', 'Select type')} />
          </SelectTrigger>
          <SelectContent>
            {types?.map((type) => (
              <SelectItem key={type.id} value={type.id.toString()}>
                {t(`interactionTypes.${type.code}`, { defaultValue: type.name })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label
          className="text-muted-foreground mb-1 block text-xs"
          htmlFor="dialer-contact-comment"
        >
          {t('dialer.call.contactComment', 'contact comment')}
        </label>
        <Textarea
          id="dialer-contact-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('dialer.call.enterComment', 'Enter comment...')}
        />
      </div>

      {summary?.loan && <LoanCard loan={summary.loan} />}

      <Button
        variant="primary"
        leftIcon={<Icons.Add size={16} />}
        onClick={handleSubmit}
        isLoading={createInteraction.isPending}
        className="self-start"
      >
        {t('dialer.call.saveInteraction', 'Save interaction')}
      </Button>
    </div>
  )
}

export default CallInteractionForm
