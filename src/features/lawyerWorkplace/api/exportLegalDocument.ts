import jsPDF from 'jspdf'
import { loadNotoSansFont } from '@/lib/loadNotoFont'
import { legalApi } from './legalApi'

/**
 * Client-side PDF export for "generated" reply-EDO documents (ВИХ / НБУ).
 *
 * These documents are metadata-only in the backend (no stored file), so there
 * is nothing to download. Instead we render the sent letter — fetched from its
 * source message — plus an EDO header into a PDF on the fly.
 *
 * Uses the embedded NotoSans font so Cyrillic (Ukrainian) renders correctly,
 * mirroring the payment-receipt generator.
 */

export interface LegalDocumentExportMeta {
  label: string
  value: string
}

export interface LegalDocumentExportInput {
  /** EDO number, e.g. "ВИХ-2026-001" — also the file name. */
  number: string
  /** Subject to use when the source message can't be loaded. */
  fallbackSubject: string
  /** Outgoing reply message the document was generated from. */
  sourceMessageId: string | null
  /** Localized metadata rows rendered under the number. */
  meta: LegalDocumentExportMeta[]
}

function htmlToPlainText(html: string): string {
  const el = window.document.createElement('div')
  el.innerHTML = html
  const text = el.textContent || el.innerText || ''
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

export async function exportLegalDocumentPdf(input: LegalDocumentExportInput): Promise<void> {
  // Pull the actual sent letter from its source message when available;
  // otherwise fall back to a metadata-only export.
  let subject = input.fallbackSubject
  let body = ''
  if (input.sourceMessageId) {
    try {
      const message = await legalApi.getMessage(input.sourceMessageId)
      subject = message.subject?.trim() || input.fallbackSubject
      body =
        message.body_text?.trim() || (message.body_html ? htmlToPlainText(message.body_html) : '')
    } catch {
      // Keep the metadata-only export rather than failing the download.
    }
  }

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  loadNotoSansFont(doc)
  const setFont = (style: 'normal' | 'bold') => {
    try {
      doc.setFont('NotoSans', style)
    } catch {
      doc.setFont('helvetica', style)
    }
  }

  const marginX = 18
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - marginX * 2
  let y = 20

  // EDO number
  setFont('bold')
  doc.setFontSize(15)
  doc.text(input.number, marginX, y)
  y += 8

  // Metadata block
  setFont('normal')
  doc.setFontSize(10)
  for (const row of input.meta) {
    if (!row.value) continue
    for (const line of doc.splitTextToSize(`${row.label}: ${row.value}`, contentWidth)) {
      doc.text(line, marginX, y)
      y += 5
    }
  }

  // Divider
  y += 3
  doc.setDrawColor(210)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  // Subject
  setFont('bold')
  doc.setFontSize(12)
  for (const line of doc.splitTextToSize(subject, contentWidth)) {
    doc.text(line, marginX, y)
    y += 6
  }
  y += 2

  // Body
  setFont('normal')
  doc.setFontSize(11)
  const lineHeight = 5.5
  for (const line of doc.splitTextToSize(body || '—', contentWidth)) {
    if (y > pageHeight - 18) {
      doc.addPage()
      y = 20
    }
    doc.text(line, marginX, y)
    y += lineHeight
  }

  doc.save(`${input.number}.pdf`)
}
