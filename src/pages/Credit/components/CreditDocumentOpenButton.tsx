/**
 * Кнопка открытия файла документа.
 *
 * Общая для документов заявки и кредита: ручка отдачи файла одна и работает по
 * идентификатору документа, не зная, чей он. Раньше кнопка была только у
 * заявки — не по замыслу, а потому что документов кредита на стенде нет ни
 * одного, и отсутствующее легко не заметить.
 *
 * Файл забираем запросом, а не ссылкой: ручке нужны заголовки авторизации.
 * Политику inline/attachment задаёт СЕРВЕР (файл прислал клиент, доверять его
 * типу нельзя) — фронт лишь исполняет решение сервера.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { creditApi, CreditApiError } from '@/features/credit/api/creditApi'
import type { CreditDocumentMeta } from '@/features/credit/api/types'

export function CreditDocumentOpenButton({
  document: doc,
  onError,
}: {
  document: CreditDocumentMeta
  onError?: (message: string) => void
}) {
  const { t } = useTranslation('common')
  const [busy, setBusy] = useState(false)

  const open = async () => {
    setBusy(true)
    try {
      const { blob, disposition } = await creditApi.documentContent(doc.document_id)
      const url = URL.createObjectURL(blob)
      if (disposition.startsWith('inline')) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        const link = window.document.createElement('a')
        link.href = url
        link.download = doc.title ?? 'document'
        window.document.body.append(link)
        link.click()
        link.remove()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      onError?.(error instanceof CreditApiError ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size="sm" variant="white-secondary" isLoading={busy} onClick={() => void open()}>
      {t('credit.actions.openDocument')}
    </Button>
  )
}

export default CreditDocumentOpenButton
