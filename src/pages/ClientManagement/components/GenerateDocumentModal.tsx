/**
 * Generate Document Modal
 *
 * Opened from the "Generate document" button inside DocumentUploadModal.
 * Flow: pick a credit → pick a template (availability computed per credit by
 * the backend) → pick a document type → optional outgoing number → generate.
 *
 * On success the PDF is already persisted into the client's documents (the
 * list is invalidated); the modal switches to a success screen that offers the
 * .docx twin for download.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { Modal, ModalHeader, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { DocumentTypePill } from '@/components/DocumentTypePill'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { clientKeys } from '@/features/clients/hooks/useClients'
import { legalRegistryKeys } from '@/features/lawyerWorkplace/hooks/useLegalRegistry'
import { useDocumentTypes } from '@/features/documentTypes'
import {
  useGenerationOptions,
  useGenerateDocument,
  type GenerateDocumentResponse,
  type DeliveryChannel,
} from '@/features/documents'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'

interface Loan {
  id: number
  loanNumber: string
  counterparty: string
  status?: string
}

interface GenerateDocumentModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  loans: Loan[]
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Delivery channels offered when sending the generated letter to the client. */
const DELIVERY_CHANNELS: ReadonlyArray<{
  value: DeliveryChannel
  labelKey: string
  labelFallback: string
}> = [
  {
    value: 'email',
    labelKey: 'pages.clients.detail.generateModal.channels.email',
    labelFallback: 'Ел. пошта',
  },
  {
    value: 'telegram',
    labelKey: 'pages.clients.detail.generateModal.channels.telegram',
    labelFallback: 'Telegram',
  },
  {
    value: 'viber',
    labelKey: 'pages.clients.detail.generateModal.channels.viber',
    labelFallback: 'Viber',
  },
  {
    value: 'whatsapp',
    labelKey: 'pages.clients.detail.generateModal.channels.whatsapp',
    labelFallback: 'WhatsApp',
  },
  {
    value: 'sms',
    labelKey: 'pages.clients.detail.generateModal.channels.sms',
    labelFallback: 'SMS',
  },
  {
    value: 'post',
    labelKey: 'pages.clients.detail.generateModal.channels.post',
    labelFallback: 'Поштою',
  },
]

/** Decode a base64 payload into a Blob for client-side download. */
function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

export function GenerateDocumentModal({
  open,
  onClose,
  clientId,
  loans,
}: GenerateDocumentModalProps) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  // Modal is mounted only while open (parent guards with a conditional), so
  // lazy initialisers give a fresh form every time it opens.
  const [debtId, setDebtId] = useState<number | null>(() =>
    loans.length === 1 ? loans[0].id : null
  )
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [docTypeId, setDocTypeId] = useState<number | null>(null)
  const [indexNum, setIndexNum] = useState('')
  const [deliveryChannel, setDeliveryChannel] = useState<DeliveryChannel | null>(null)
  const [deliveryContact, setDeliveryContact] = useState('')
  const [generated, setGenerated] = useState<GenerateDocumentResponse | null>(null)
  const [errorReason, setErrorReason] = useState<string | null>(null)

  const {
    data: options,
    isLoading: optionsLoading,
    isError: optionsError,
  } = useGenerationOptions(clientId, open)
  const { data: types } = useDocumentTypes({ includeHidden: false })
  const generateMutation = useGenerateDocument()

  // When the backend numbers outgoing letters from the correspondence
  // registry, the manual number field is hidden and any typed index_num is
  // dropped (the server ignores it). Older backends omit the flag → manual.
  const registryNumbering = options?.registry_numbering === true

  /** Map a backend reason code to a human-readable string. */
  const reasonLabel = (reason?: string): string => {
    switch (reason) {
      case 'debt_not_closed':
        return t('pages.clients.detail.generateModal.reasons.debt_not_closed', 'Кредит не закритий')
      case 'debt_closed':
        return t('pages.clients.detail.generateModal.reasons.debt_closed', 'Кредит закритий')
      case 'no_active_rr':
        return t(
          'pages.clients.detail.generateModal.reasons.no_active_rr',
          'Немає діючої реструктуризації'
        )
      case 'no_active_promise':
        return t(
          'pages.clients.detail.generateModal.reasons.no_active_promise',
          'Немає актуальної обіцянки платежу'
        )
      default:
        return t(
          'pages.clients.detail.generateModal.reasons.unavailable',
          'Недоступно для цього кредиту'
        )
    }
  }

  // Availability of each template for the currently selected credit.
  // CEO decision (23.07): templates the deal cannot generate are HIDDEN,
  // not greyed out — only a muted counter reveals that some were filtered.
  const { templatesForDebt, hiddenCount } = useMemo(() => {
    if (debtId == null || !options) return { templatesForDebt: [], hiddenCount: 0 }
    const all = options.templates.map((tpl) => {
      const entry = tpl.debts.find((d) => d.debt_id === debtId)
      return {
        id: tpl.id,
        name: tpl.name,
        documentType: tpl.document_type,
        available: entry?.available ?? false,
        reason: entry?.reason,
      }
    })
    const availableOnly = all.filter((tpl) => tpl.available)
    return { templatesForDebt: availableOnly, hiddenCount: all.length - availableOnly.length }
  }, [options, debtId])

  const handleSelectDebt = (value: string) => {
    setDebtId(value ? Number(value) : null)
    // A template available for one credit may not be for another.
    setTemplateId(null)
    setErrorReason(null)
  }

  const selectedTemplate = templatesForDebt.find((tpl) => tpl.id === templateId)
  const boundType = selectedTemplate?.documentType ?? null

  const canGenerate =
    debtId != null &&
    templateId != null &&
    (boundType != null || docTypeId != null) &&
    !generateMutation.isPending

  const handleGenerate = async () => {
    if (debtId == null || templateId == null) return
    if (boundType == null && docTypeId == null) return
    setErrorReason(null)
    const trimmedIndex = indexNum.trim()
    const parsedIndex = trimmedIndex ? Number(trimmedIndex) : undefined
    // Under registry numbering the server assigns the number and ignores any
    // client-supplied index_num, so never send it.
    const includeIndex = !registryNumbering && parsedIndex != null && Number.isFinite(parsedIndex)
    // Delivery channel is optional; the contact rides along only when both a
    // channel is chosen and a destination was typed.
    const trimmedContact = deliveryContact.trim()
    try {
      const res = await generateMutation.mutateAsync({
        templateId,
        payload: {
          client_id: clientId,
          debt_id: debtId,
          // Bound to the template server-side; send only a manual pick.
          ...(boundType == null && docTypeId != null ? { document_type_id: docTypeId } : {}),
          ...(includeIndex ? { index_num: parsedIndex } : {}),
          ...(deliveryChannel ? { delivery_channel: deliveryChannel } : {}),
          ...(deliveryChannel && trimmedContact ? { delivery_contact: trimmedContact } : {}),
        },
      })
      queryClient.invalidateQueries({ queryKey: clientKeys.documents(clientId) })
      // A generated letter lands in the correspondence registry (outgoing);
      // invalidate the whole registry family by prefix so the row shows up on
      // the next tab open regardless of active filters/pagination.
      queryClient.invalidateQueries({ queryKey: legalRegistryKeys.root() })
      toast.success(t('status.success'))
      setGenerated(res)
    } catch (err) {
      const axErr = err as AxiosError<{
        detail?: string | { message?: string; reason?: string }
      }>
      const status = axErr?.response?.status
      const detail = axErr?.response?.data?.detail
      // 409 detail is an object {message, reason}; keep the plain-string
      // fallback in case the shape ever degrades to FastAPI's default.
      const reason = typeof detail === 'string' ? detail : detail?.reason
      if (status === 409 && reason) {
        setErrorReason(reasonLabel(reason))
      } else {
        setErrorReason(
          t('pages.clients.detail.generateModal.genericError', 'Не вдалося згенерувати документ')
        )
      }
    }
  }

  const handleDownloadDocx = () => {
    if (!generated) return
    const blob = base64ToBlob(generated.docx_base64, DOCX_MIME)
    const base = generated.document_name
    const filename = base.toLowerCase().endsWith('.docx') ? base : `${base}.docx`
    downloadBlob(blob, filename)
  }

  const title = t('pages.clients.detail.generateModal.title', 'Згенерувати документ')

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader icon={<Icons.Sparkles size={20} className="text-primary-500" />} title={title} />

      {generated ? (
        /* ---- Success screen ---- */
        <div className="flex flex-col items-center gap-4 p-4 text-center md:p-6">
          <Icons.Success size={40} className="text-success-500" />
          <div className="flex flex-col gap-1">
            <p className="text-secondary-900 text-base font-medium">
              {t('pages.clients.detail.generateModal.successTitle', 'Документ згенеровано')}
            </p>
            <p className="text-secondary-600 text-sm">{generated.document_name}</p>
            <p className="text-secondary-500 text-xs">
              {t('pages.clients.detail.generateModal.indexNum', 'Вихідний №')}:{' '}
              {generated.index_num}
            </p>
          </div>
          <p className="text-secondary-600 text-sm">
            {t(
              'pages.clients.detail.generateModal.successPdfHint',
              'PDF додано до документів клієнта.'
            )}
          </p>
          <Button
            variant="outline"
            type="button"
            leftIcon={<Icons.Download size={16} />}
            onClick={handleDownloadDocx}
          >
            {t('pages.clients.detail.generateModal.downloadDocx', 'Завантажити .docx')}
          </Button>
        </div>
      ) : (
        /* ---- Form ---- */
        <div className="flex flex-col gap-4 p-4 md:p-6">
          {/* Credit */}
          <div>
            <label className="text-secondary-700 mb-1 block text-sm font-medium">
              {t('pages.clients.detail.generateModal.credit', 'Кредит')}
            </label>
            <Select value={debtId == null ? '' : String(debtId)} onValueChange={handleSelectDebt}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t(
                    'pages.clients.detail.generateModal.creditPlaceholder',
                    'Оберіть кредит'
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {loans.map((loan) => (
                  <SelectItem key={loan.id} value={String(loan.id)}>
                    #{loan.loanNumber} — {loan.counterparty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates */}
          <div>
            <label className="text-secondary-700 mb-1 block text-sm font-medium">
              {t('pages.clients.detail.generateModal.template', 'Шаблон')}
            </label>
            {debtId == null ? (
              <p className="text-secondary-500 rounded-lg border border-dashed border-[#EBECE8] px-3 py-4 text-sm">
                {t('pages.clients.detail.generateModal.selectCreditFirst', 'Спершу оберіть кредит')}
              </p>
            ) : optionsLoading ? (
              <p className="text-secondary-500 px-3 py-4 text-sm">{t('status.loading', '…')}</p>
            ) : optionsError ? (
              <p className="text-sm text-red-500">
                {t(
                  'pages.clients.detail.generateModal.loadError',
                  'Не вдалося завантажити шаблони'
                )}
              </p>
            ) : templatesForDebt.length === 0 ? (
              <p className="text-secondary-500 rounded-lg border border-dashed border-[#EBECE8] px-3 py-4 text-sm">
                {t('pages.clients.detail.generateModal.templatesEmpty', 'Немає доступних шаблонів')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {templatesForDebt.map((tpl) => {
                  const isSelected = tpl.id === templateId
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setTemplateId(tpl.id)}
                      className={cn(
                        'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'border-primary-400 bg-primary-50/50'
                          : 'hover:border-secondary-400 hover:bg-secondary-50 border-[#EBECE8]'
                      )}
                    >
                      <span className="text-secondary-900 text-sm font-medium">{tpl.name}</span>
                    </button>
                  )
                })}
                {hiddenCount > 0 && (
                  <p className="text-secondary-400 text-xs">
                    {t('pages.clients.detail.generateModal.hiddenTemplates', {
                      count: hiddenCount,
                      defaultValue: 'Приховано шаблонів, недоступних для цього кредиту: {{count}}',
                    })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Document type: auto from the template, manual pick otherwise */}
          <div>
            <label className="text-secondary-700 mb-1 block text-sm font-medium">
              {t('pages.clients.detail.generateModal.documentType', 'Тип документа')}
            </label>
            {boundType != null ? (
              <div className="flex items-center gap-2">
                <DocumentTypePill name={boundType.name} hex={boundType.color} />
                <span className="text-secondary-400 text-xs">
                  {t(
                    'pages.clients.detail.generateModal.typeFromTemplate',
                    'застосовується автоматично з шаблону'
                  )}
                </span>
              </div>
            ) : (
              <Select
                value={docTypeId == null ? '' : String(docTypeId)}
                onValueChange={(value) => setDocTypeId(value ? Number(value) : null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t('pages.clients.detail.documentTypePlaceholder', 'Оберіть тип')}
                  >
                    {(() => {
                      const selected = (types ?? []).find((dt) => dt.id === docTypeId)
                      return selected ? (
                        <DocumentTypePill name={selected.name} hex={selected.color} />
                      ) : null
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(types ?? []).map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      <DocumentTypePill name={type.name} hex={type.color} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Outgoing number */}
          <div>
            <label className="text-secondary-700 mb-1 block text-sm font-medium">
              {t('pages.clients.detail.generateModal.indexNum', 'Вихідний №')}
            </label>
            {registryNumbering ? (
              <p className="text-secondary-500 mt-1 text-xs">
                {t(
                  'pages.clients.detail.generateModal.indexNumRegistryHint',
                  'Вихідний № буде присвоєно автоматично з реєстру кореспонденції'
                )}
              </p>
            ) : (
              <>
                <Input
                  value={indexNum}
                  inputMode="numeric"
                  onChange={(e) => setIndexNum(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={t('pages.clients.detail.generateModal.indexNumPlaceholder', 'Авто')}
                />
                <p className="text-secondary-500 mt-1 text-xs">
                  {t(
                    'pages.clients.detail.generateModal.indexNumHint',
                    'Залиште порожнім для автонумерації. Реєстр вихідних номерів буде запроваджено пізніше.'
                  )}
                </p>
              </>
            )}
          </div>

          {/* Delivery to the client — optional; feeds the outgoing registry's
              "from → to" column. Left blank, nothing is sent. */}
          <div className="flex flex-col gap-4 border-t border-[#EBECE8] pt-4">
            <div>
              <label className="text-secondary-700 mb-1 block text-sm font-medium">
                {t('pages.clients.detail.generateModal.deliveryChannel', 'Канал відправки клієнту')}
              </label>
              <Select
                value={deliveryChannel ?? ''}
                onValueChange={(value) =>
                  setDeliveryChannel(value ? (value as DeliveryChannel) : null)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t(
                      'pages.clients.detail.generateModal.deliveryChannelPlaceholder',
                      'Оберіть канал (необовʼязково)'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_CHANNELS.map((channel) => (
                    <SelectItem key={channel.value} value={channel.value}>
                      {t(channel.labelKey, channel.labelFallback)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-secondary-700 mb-1 block text-sm font-medium">
                {t('pages.clients.detail.generateModal.deliveryContact', 'Контакт (куди)')}
              </label>
              <Input
                value={deliveryContact}
                onChange={(e) => setDeliveryContact(e.target.value)}
                placeholder={t(
                  'pages.clients.detail.generateModal.deliveryContactPlaceholder',
                  '+380… або email'
                )}
              />
            </div>
          </div>

          {errorReason && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              <Icons.Warning size={16} />
              <span>{errorReason}</span>
            </div>
          )}
        </div>
      )}

      <ModalFooter>
        {generated ? (
          <Button onClick={onClose} className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm">
            {t('pages.clients.detail.generateModal.done', 'Готово')}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={onClose}
              className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
            >
              {t('actions.cancel', 'Скасувати')}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
            >
              {generateMutation.isPending
                ? t('pages.clients.detail.generateModal.generating', 'Генерація…')
                : t('pages.clients.detail.generateModal.generate', 'Згенерувати')}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}
