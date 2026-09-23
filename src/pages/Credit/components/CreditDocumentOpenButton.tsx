/**
 * Кнопка открытия файла документа — одна на карточки заявки и кредита.
 *
 * Дверей содержимого две — у заявки и у кредита, — и каждая отдаёт только
 * документ СВОЕЙ сущности, чужой отвечает 404. Поэтому владельца называет
 * карточка, из списка которой пришёл документ (`owner`), а не поля самого
 * документа: договор выданного кредита привязан и к заявке, и к кредиту, и выбор
 * по его полям сделал бы поведение кнопки зависимым от выдачи.
 *
 * Если по записям модуля выдавать нечего, кнопка говорит это ДО нажатия и
 * запроса не шлёт. Признака в ответе нет (модуль старше него) — кнопка активна:
 * честная ошибка при нажатии безопаснее спрятанного документа.
 *
 * Отказ называется своими словами по машинному коду модуля: его `detail` написан
 * по-русски и со служебными именами, а текст ошибки транспорта оператору ничего
 * не говорит. Новое нажатие снимает прежний отказ: иначе после удачного открытия
 * над таблицей висела бы чужая ошибка.
 *
 * Файл забираем запросом, а не ссылкой: ручке нужны заголовки авторизации.
 * Политику inline/attachment задаёт СЕРВЕР (файл прислал клиент, доверять его
 * типу нельзя) — фронт лишь исполняет решение сервера. Единственное, что фронт
 * меняет, — ТИП blob'а сгенерированного договора: `text/markdown` браузер
 * скачал бы, а не показал, поэтому договор открывается как текст. Байты те же.
 *
 * Вкладку открываем в самом нажатии, ДО запроса: окно, открытое после `await`,
 * браузер считает открытым без участия человека и молча блокирует. Вкладку не
 * дали (блокировщик; OneX — всегда: не-http(s) адреса он отклоняет) — документ
 * отдаётся скачиванием тем же файлом, и оператор узнаёт это словами, а не тишиной.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button } from '@/components/ui/Button'
import { creditApi, CreditApiError } from '@/features/credit/api/creditApi'
import type { CreditDocumentMeta } from '@/features/credit/api/types'

/** Чья карточка показала документ — её дверью он и открывается. */
export type CreditDocumentOwner = { kind: 'application' | 'loan'; id: string }

/**
 * Текст отказа по машинному коду модуля. Ключи — статическими литералами: страж
 * словарей видит только их, шаблонный ключ прошёл бы мимо него.
 */
function documentOpenErrorText(t: TFunction, error: unknown): string {
  const status = error instanceof CreditApiError ? error.status : undefined
  const code = error instanceof CreditApiError ? error.code : undefined
  switch (code) {
    case 'not_found':
      return t('credit.documentOpen.errorNotFound')
    case 'document_revision_unreproducible':
      return t('credit.documentOpen.errorGone')
    case 'document_file_missing':
      return t('credit.documentOpen.errorMissing')
    case 'document_content_diverged':
      return t('credit.documentOpen.errorDiverged')
    case 'forbidden':
    case 'permission_denied':
      return t('credit.documentOpen.errorForbidden')
  }
  // Единственный запасной путь по статусу: 403 шлюза — тот же отказ в доступе.
  // 404/500/502 без кода — маршрут или прокси, а не «документа нет в карточке».
  if (status === 403) return t('credit.documentOpen.errorForbidden')
  return t('credit.documentOpen.errorGeneric', { status: status ?? '—' })
}

/**
 * Имя файла из `Content-Disposition`. Модуль кладёт ASCII-имя в `filename`, а
 * настоящее — в `filename*`: кириллицу первое теряет, поэтому второе читается
 * первым.
 */
function filenameFromDisposition(disposition: string): string | null {
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim())
    } catch {
      /* битая кодировка — остаётся ASCII-имя */
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"/i.exec(disposition)
  return plain?.[1] || null
}

/**
 * Символы, которые меняют ВИДИМОЕ имя, не меняя настоящего: управляющие (C0, C1),
 * метки, встраивания и изоляторы направления письма — весь набор Bidi_Control
 * (U+202E показывает «рахунок<U+202E>fdp.exe» как «рахунокexe.pdf») — и
 * разделители путей. Имя загруженного файла дал клиент. Перечень записан
 * escape-кодами: сами символы в исходнике переставили бы строку на экране.
 */
const UNSAFE_NAME_CHARS =
  // eslint-disable-next-line no-control-regex -- управляющие символы и есть предмет фильтра
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069/\\]/g

/** Имя для скачивания без опасных символов; ничего не осталось — `null`. */
function safeDownloadName(name: string | null | undefined): string | null {
  return name?.replace(UNSAFE_NAME_CHARS, '').trim() || null
}

export function CreditDocumentOpenButton({
  document: doc,
  owner,
  onError,
}: {
  document: CreditDocumentMeta
  owner: CreditDocumentOwner
  /** Текст отказа; `null` — прежний отказ снят новым нажатием. */
  onError?: (message: string | null) => void
}) {
  const { t } = useTranslation('common')
  const [busy, setBusy] = useState(false)
  const unavailable = doc.content_available === false

  const open = async () => {
    if (unavailable) return
    // Прежний отказ снимается в самом нажатии, а не по ответу: пока грузится
    // новый документ, над таблицей не должна висеть ошибка прошлого.
    onError?.(null)
    // Пустая вкладка без ссылки на CRM: `noopener` здесь не годится — с ним
    // открытие всегда возвращает `null`, и ни задать адрес, ни узнать о блокировке
    // было бы нельзя. Связь с окном CRM рвём сами.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    setBusy(true)
    try {
      const { blob, disposition } =
        owner.kind === 'loan'
          ? await creditApi.loanDocumentContent(owner.id, doc.document_id)
          : await creditApi.applicationDocumentContent(owner.id, doc.document_id)
      const inline = disposition.toLowerCase().startsWith('inline')
      const shown =
        inline && blob.type.toLowerCase().startsWith('text/markdown')
          ? new Blob([blob], { type: 'text/plain;charset=utf-8' })
          : blob
      const url = URL.createObjectURL(shown)
      if (inline && tab) {
        tab.location.href = url
      } else {
        tab?.close()
        const link = window.document.createElement('a')
        link.href = url
        link.download =
          safeDownloadName(filenameFromDisposition(disposition)) ??
          safeDownloadName(doc.title) ??
          'document'
        window.document.body.append(link)
        link.click()
        link.remove()
        // Показать было негде: вкладку не дали, а OneX не даёт её никогда. Файл
        // ушёл скачиванием, и оператор узнаёт, почему его нет на экране.
        if (inline) onError?.(t('credit.documentOpen.tabBlocked'))
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      tab?.close()
      onError?.(documentOpenErrorText(t, error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {unavailable && (
        <span className="text-muted-foreground mr-2 text-xs">
          {t('credit.documentOpen.unavailable')}
        </span>
      )}
      <Button
        size="sm"
        variant="white-secondary"
        isLoading={busy}
        disabled={unavailable}
        title={unavailable ? t('credit.documentOpen.unavailableHint') : undefined}
        onClick={() => void open()}
      >
        {t('credit.actions.openDocument')}
      </Button>
    </>
  )
}

export default CreditDocumentOpenButton
