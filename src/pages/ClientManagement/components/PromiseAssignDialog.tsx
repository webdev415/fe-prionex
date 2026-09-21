/**
 * PromiseAssignDialog — dedicated form for `requires_payload=true` tags.
 *
 * Used for promise_to_pay (and any future payload-aware tag) where the
 * operator must enter ЦД (target date+time) and amount before assigning.
 *
 * The data goes into tag_assignments.payload via the extended assign API
 * (`POST /api/v1/clients/{id}/tags` with `payload`). The tag-service then
 * uses the stored payload from the scheduled rule "Просрочена ЦД обещания"
 * to auto-replace promise_to_pay → porushena_obitsyanka once the ЦД passes.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import { Icons } from '@/lib/icons'
import { toast } from 'sonner'
import { assignTagExtended } from '@/features/tags/api/tagsApi'
import { useQueryClient } from '@tanstack/react-query'
import { Pii } from '@/lib/openreplay/pii'

interface PromiseAssignDialogProps {
  open: boolean
  clientId: number
  clientName: string
  tagId: number
  tagName: string
  onClose: () => void
  /**
   * Called once, after the tag is assigned, before the dialog closes.
   *
   * Payload tags never reach TagSelectorModal's handleSave -- selecting one
   * routes here instead -- so without this the parent could not arm auto-open
   * of the chain executor for them. promise_to_pay is a requires_payload tag
   * and the one most likely to have a chain attached, so the feature was
   * missing its most probable case.
   *
   * Not called when the assign fails.
   */
  onAssigned?: () => void
}

export function PromiseAssignDialog({
  open,
  clientId,
  clientName,
  tagId,
  tagName,
  onClose,
  onAssigned,
}: PromiseAssignDialogProps) {
  const queryClient = useQueryClient()
  const [promiseDate, setPromiseDate] = useState<Date | null>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(14, 0, 0, 0)
    return d
  })
  const [promiseAmount, setPromiseAmount] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const dateError =
    !promiseDate || promiseDate.getTime() <= Date.now() ? 'ЦД должна быть в будущем' : undefined
  const amountError =
    promiseAmount && (isNaN(Number(promiseAmount)) || Number(promiseAmount) <= 0)
      ? 'Сумма должна быть положительным числом'
      : undefined

  const canSave = !dateError && !amountError && !isSaving

  const handleSave = async () => {
    if (!canSave || !promiseDate) return
    setIsSaving(true)
    try {
      await assignTagExtended(clientId, tagId, {
        payload: {
          promise_date: promiseDate.toISOString(),
          ...(promiseAmount ? { promise_amount: Number(promiseAmount) } : {}),
        },
      })
      toast.success(
        <span>
          {`${tagName} назначен клиенту `}
          <Pii>{clientName}</Pii>
        </span>
      )
      queryClient.invalidateQueries({ queryKey: ['clients', clientId, 'tags'] })
      // Inside the try, so a failed assign never arms auto-open. Reached only
      // after assignTagExtended resolved, and this dialog writes exactly one
      // tag, so there is no "nothing changed" case to guard the way
      // TagSelectorModal's multi-tag save needs.
      onAssigned?.()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось назначить тег')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
            <Icons.Clock01 size={18} strokeWidth={2} className="text-warning-700" />
          </div>
        }
        title={
          <>
            {`Назначить «${tagName}» — `}
            <Pii>{clientName}</Pii>
          </>
        }
      />
      <ModalContent>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Этот тег требует целевую дату оплаты. Когда ЦД наступит, фоновое правило автоматически
            заменит «{tagName}» на «Порушена обіцянка».
          </p>
          <DateSelect
            label="ЦД (дата + время) *"
            value={promiseDate}
            onChange={(e: { value: Date | null }) => setPromiseDate(e.value)}
            showTimeSelect
            timeIntervals={15}
            format="dd.MM.yyyy HH:mm"
            min={new Date()}
            error={dateError}
            required
          />
          <Input
            label="Сумма обещания (необязательно)"
            type="number"
            step="0.01"
            min="0"
            placeholder="например, 1500.00"
            value={promiseAmount}
            onChange={(e) => setPromiseAmount(e.target.value)}
            error={amountError}
          />
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Отмена
        </Button>
        <Button onClick={handleSave} disabled={!canSave} isLoading={isSaving}>
          Назначить
        </Button>
      </ModalFooter>
    </Modal>
  )
}
