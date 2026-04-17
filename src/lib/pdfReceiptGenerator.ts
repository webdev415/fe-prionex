// /**
//  * PDF Receipt Generator
//  *
//  * Utility function to generate payment receipt PDFs matching the template design.
//  */

// import jsPDF from 'jspdf'
// import { loadLexendFont } from './loadLexendFont'

// export interface PaymentReceiptData {
//   receiptNumber: string
//   paymentId: string
//   dateIssued: string
//   clientName: string
//   clientId: string
//   phone: string
//   contract: string
//   paymentDate: string
//   paymentMethod: string
//   transactionRef: string
//   paymentAmount: number
//   daysPastDue?: number
//   status: string
//   outstandingBalanceBefore: number
//   paymentApplied: number
//   remainingBalance: number
//   receivedBy: string
//   verifiedBy?: string
//   verifiedOn?: string
//   companyName?: string
//   companyAddress?: string
//   companyPhone?: string
//   companyEmail?: string
// }

// const formatCurrency = (amount: number): string => {
//   // Format with comma as thousands separator and period as decimal separator
//   // Example: ₴ 5,000.00
//   const formatted = amount.toLocaleString('en-US', {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })
//   return `₴ ${formatted}`
// }

// const formatDate = (dateString: string): string => {
//   try {
//     const date = new Date(dateString)
//     return date.toISOString().split('T')[0]
//   } catch {
//     return dateString
//   }
// }

// const formatDateTime = (dateString: string): string => {
//   try {
//     const date = new Date(dateString)
//     const year = date.getFullYear()
//     const month = String(date.getMonth() + 1).padStart(2, '0')
//     const day = String(date.getDate()).padStart(2, '0')
//     const hours = String(date.getHours()).padStart(2, '0')
//     const minutes = String(date.getMinutes()).padStart(2, '0')
//     const seconds = String(date.getSeconds()).padStart(2, '0')
//     return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
//   } catch {
//     return dateString
//   }
// }

// // Helper function to set font (tries Lexend, falls back to helvetica)
// const setFont = (doc: jsPDF, style: 'normal' | 'bold' = 'normal') => {
//   try {
//     // Try to use Lexend if available
//     const fonts = doc.getFontList()
//     if ('NotoSans' in fonts) {
//       doc.setFont('NotoSans', style)
//     } else {
//       doc.setFont('helvetica', style)
//     }
//   } catch {
//     doc.setFont('helvetica', style)
//   }
// }

// export function generatePaymentReceiptPDF(data: PaymentReceiptData): void {
//   const doc = new jsPDF()

//   // Try to load Lexend font
//   loadLexendFont(doc)

//   const pageWidth = doc.internal.pageSize.getWidth()
//   const pageHeight = doc.internal.pageSize.getHeight()
//   const margin = 20
//   let yPosition = margin

//   // Set font styles - matching template
//   const titleFontSize = 20
//   const headingFontSize = 12
//   const labelFontSize = 10
//   const valueFontSize = 10
//   const footerFontSize = 8

//   // Header Section
//   doc.setFontSize(titleFontSize)
//   setFont(doc, 'bold')
//   doc.text('Payment Receipt', margin, yPosition)

//   doc.setFontSize(labelFontSize)
//   setFont(doc, 'normal')
//   const companyName = data.companyName || 'PrivatBank Debt Collection'
//   const companyNameWidth = doc.getTextWidth(companyName)
//   doc.text(companyName, pageWidth - margin - companyNameWidth, yPosition)

//   yPosition += 20

//   // Receipt Details Section
//   doc.setFontSize(headingFontSize)
//   setFont(doc, 'bold')
//   doc.text('Receipt Details', margin, yPosition)
//   yPosition += 10

//   doc.setFontSize(labelFontSize)
//   setFont(doc, 'normal')
//   doc.text('Receipt #:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(data.receiptNumber, margin + 40, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   doc.text('Payment ID:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(data.paymentId, margin + 40, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   doc.text('Date Issued:', margin, yPosition)
//   setFont(doc, 'bold')
//   const dateIssued = formatDate(data.dateIssued)
//   doc.text(dateIssued, margin + 40, yPosition)
//   yPosition += 12

//   // Client Information Section
//   doc.setFontSize(headingFontSize)
//   setFont(doc, 'bold')
//   doc.text('Client Information', margin, yPosition)
//   yPosition += 10

//   doc.setFontSize(labelFontSize)
//   setFont(doc, 'normal')
//   doc.text('Name:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(data.clientName, margin + 30, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   doc.text('Client ID:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(`#${data.clientId}`, margin + 30, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   doc.text('Phone:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(data.phone, margin + 30, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   doc.text('Contract:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(data.contract, margin + 30, yPosition)
//   yPosition += 12

//   // Payment Details Section
//   doc.setFontSize(headingFontSize)
//   setFont(doc, 'bold')
//   doc.text('Payment Details', margin, yPosition)
//   yPosition += 10

//   doc.setFontSize(labelFontSize)
//   setFont(doc, 'normal')
//   doc.text('Payment Date:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(formatDate(data.paymentDate), margin + 40, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   doc.text('Payment Method:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(data.paymentMethod, margin + 40, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   doc.text('Transaction Ref:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(data.transactionRef, margin + 40, yPosition)
//   yPosition += 12

//   // Payment Amount Section
//   doc.setFontSize(headingFontSize)
//   setFont(doc, 'bold')
//   doc.text('Payment Amount', margin, yPosition)
//   yPosition += 10

//   doc.setFontSize(valueFontSize)
//   setFont(doc, 'bold')
//   const paymentReceivedText = 'Payment Received:'
//   doc.text(paymentReceivedText, margin, yPosition)
//   doc.setFontSize(valueFontSize + 2)
//   const paymentAmountText = formatCurrency(data.paymentAmount)
//   doc.text(paymentAmountText, margin + 60, yPosition)
//   yPosition += 12

//   // Debt Summary Section
//   doc.setFontSize(headingFontSize)
//   setFont(doc, 'bold')
//   doc.text('Debt Summary', margin, yPosition)
//   yPosition += 10

//   doc.setFontSize(labelFontSize)
//   const leftColumnStartY = yPosition

//   // Left column
//   if (data.daysPastDue !== undefined) {
//     setFont(doc, 'normal')
//     doc.text('Days Past Due:', margin, yPosition)
//     setFont(doc, 'bold')
//     doc.text(data.daysPastDue.toString(), margin + 40, yPosition)
//     yPosition += 7
//   }

//   setFont(doc, 'normal')
//   doc.text('Status:', margin, yPosition)
//   setFont(doc, 'bold')
//   const statusText = data.status
//   const statusWidth = doc.getTextWidth(statusText)
//   doc.text(statusText, margin + 30, yPosition)
//   if (data.status === 'ACTIVE') {
//     doc.setFontSize(labelFontSize - 1)
//     setFont(doc, 'normal')
//     const noteText = '(Outstanding debt remains)'
//     doc.text(noteText, margin + 30 + statusWidth + 5, yPosition)
//     doc.setFontSize(labelFontSize) // Reset font size
//   }
//   const leftColumnEndY = yPosition

//   // Right column - Outstanding Balance
//   const rightColumnX = pageWidth / 2 + 10
//   yPosition = leftColumnStartY
//   doc.setFontSize(labelFontSize)
//   setFont(doc, 'normal')
//   const balanceBeforeLabel = 'Outstanding Balance Before:'
//   doc.text(balanceBeforeLabel, rightColumnX, yPosition)
//   setFont(doc, 'bold')
//   const balanceBeforeText = formatCurrency(data.outstandingBalanceBefore)
//   const balanceBeforeLabelWidth = doc.getTextWidth(balanceBeforeLabel)
//   doc.text(balanceBeforeText, rightColumnX + balanceBeforeLabelWidth + 5, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   const paymentAppliedLabel = 'Payment Applied:'
//   doc.text(paymentAppliedLabel, rightColumnX, yPosition)
//   setFont(doc, 'bold')
//   const paymentAppliedText = `- ${formatCurrency(data.paymentApplied)}`
//   const paymentAppliedLabelWidth = doc.getTextWidth(paymentAppliedLabel)
//   doc.text(paymentAppliedText, rightColumnX + paymentAppliedLabelWidth + 5, yPosition)
//   yPosition += 7

//   setFont(doc, 'normal')
//   const remainingBalanceLabel = 'Remaining Balance:'
//   doc.text(remainingBalanceLabel, rightColumnX, yPosition)
//   setFont(doc, 'bold')
//   doc.setFontSize(valueFontSize + 2)
//   const remainingBalanceText = formatCurrency(data.remainingBalance)
//   const remainingBalanceLabelWidth = doc.getTextWidth(remainingBalanceLabel)
//   doc.text(remainingBalanceText, rightColumnX + remainingBalanceLabelWidth + 5, yPosition)
//   doc.setFontSize(labelFontSize) // Reset font size

//   // Move to the maximum Y position from both columns
//   yPosition = Math.max(leftColumnEndY, yPosition) + 12

//   // Verification Section
//   doc.setFontSize(headingFontSize)
//   setFont(doc, 'bold')
//   doc.text('Verification', margin, yPosition)
//   yPosition += 10

//   doc.setFontSize(labelFontSize)
//   setFont(doc, 'normal')
//   doc.text('Received by:', margin, yPosition)
//   setFont(doc, 'bold')
//   doc.text(data.receivedBy, margin + 40, yPosition)
//   yPosition += 7

//   if (data.verifiedBy) {
//     setFont(doc, 'normal')
//     doc.text('Verified by:', margin, yPosition)
//     setFont(doc, 'bold')
//     doc.text(data.verifiedBy, margin + 40, yPosition)
//     yPosition += 7
//   }

//   if (data.verifiedOn) {
//     setFont(doc, 'normal')
//     doc.text('Verified on:', margin, yPosition)
//     setFont(doc, 'bold')
//     doc.text(formatDateTime(data.verifiedOn), margin + 40, yPosition)
//     yPosition += 7
//   }

//   // Status with checkmark
//   yPosition += 3
//   doc.setTextColor(0, 150, 0) // Green color for verified status
//   setFont(doc, 'bold')
//   doc.setFontSize(valueFontSize + 1)
//   doc.text('✓ VERIFIED AND APPLIED', margin, yPosition)
//   doc.setTextColor(0, 0, 0) // Reset to black
//   doc.setFontSize(labelFontSize) // Reset font size
//   yPosition += 12

//   // Company Information Section
//   doc.setFontSize(headingFontSize)
//   setFont(doc, 'bold')
//   doc.text(`${companyName} Department`, margin, yPosition)
//   yPosition += 10

//   doc.setFontSize(labelFontSize)
//   setFont(doc, 'normal')
//   const address = data.companyAddress || 'Kyiv, Ukraine, 01001'
//   doc.text(`Address: ${address}`, margin, yPosition)
//   yPosition += 7

//   const phone = data.companyPhone || '+380 44 123 4567'
//   doc.text(`Phone: ${phone}`, margin, yPosition)
//   yPosition += 7

//   const email = data.companyEmail || 'collections@privatbank.ua'
//   doc.text(`Email: ${email}`, margin, yPosition)
//   yPosition += 15

//   // Footer
//   doc.setFontSize(footerFontSize)
//   setFont(doc, 'normal')
//   doc.setTextColor(150, 150, 150) // Light gray color for footer
//   const generatedTime = formatDateTime(new Date().toISOString())
//   const generatedText = `Generated: ${generatedTime}`
//   const generatedWidth = doc.getTextWidth(generatedText)
//   doc.text(generatedText, pageWidth - margin - generatedWidth, pageHeight - margin)
//   doc.setTextColor(0, 0, 0) // Reset to black

//   // Save the PDF
//   const filename = `Payment_Receipt_${data.receiptNumber}.pdf`
//   doc.save(filename)
// }

import jsPDF from 'jspdf'
import { loadNotoSansFont } from './loadNotoFont'

export interface PaymentReceiptData {
  receiptNumber: string
  paymentId: string
  dateIssued: string
  clientName: string
  clientId: string
  phone: string
  contract: string
  paymentDate: string
  paymentMethod: string
  transactionRef: string
  paymentAmount: number
  daysPastDue?: number
  status: string
  outstandingBalanceBefore: number
  paymentApplied: number
  remainingBalance: number
  receivedBy: string
  verifiedBy?: string
  verifiedOn?: string
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  userTimezone?: string // User's timezone for date formatting
}

const formatCurrency = (amount: string | number): string => {
  // Format with space as thousands separator and comma as decimal separator (Ukrainian format)
  // Example: ₴ 125 450,00 (matches UI format)
  // Handle negative numbers correctly: - ₴ 10 000,00
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '₴ 0,00'
  const isNegative = num < 0
  const absAmount = Math.abs(num)
  const formatted = absAmount.toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Return with currency symbol and negative sign if needed
  return isNegative ? `- ₴ ${formatted}` : `₴ ${formatted}`
}

// Helper function to render currency with proper symbol support
const renderCurrency = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: { align?: 'left' | 'right' | 'center'; maxWidth?: number }
): void => {
  // Check if text contains currency symbol
  if (text.includes('₴')) {
    // Split symbol and amount
    const parts = text.split('₴')
    if (parts.length === 2) {
      const symbol = '₴'
      const amount = parts[1].trim()

      // Try to render the ₴ symbol - check if current font supports it
      // Try to get the width of the symbol to see if font supports it
      const symbolWidth = doc.getTextWidth(symbol)
      const amountWidth = doc.getTextWidth(` ${amount}`)
      const fullWidth = symbolWidth + amountWidth

      // If symbol width is reasonable (>= 2mm), try to render it
      // Some fonts might support ₴ even if not Lexend
      if (symbolWidth && symbolWidth >= 2) {
        // Symbol appears to be supported, render it with amount
        // For right alignment, calculate start position
        if (options?.align === 'right') {
          const startX = x - fullWidth
          doc.text(symbol, startX, y)
          doc.text(` ${amount}`, startX + symbolWidth, y)
        } else {
          doc.text(symbol, x, y)
          doc.text(` ${amount}`, x + symbolWidth, y, options)
        }
      } else {
        // Symbol not supported - use "UAH" as fallback
        // But format the amount to match UI (Ukrainian format with spaces and comma)
        const fallbackText = `UAH ${amount}`
        if (options?.align === 'right') {
          doc.text(fallbackText, x, y, { align: 'right', ...options })
        } else {
          doc.text(fallbackText, x, y, options)
        }
      }
    } else {
      // No symbol found, render as-is
      doc.text(text, x, y, options)
    }
  } else {
    // No currency symbol, render normally
    doc.text(text, x, y, options)
  }
}

const BARE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const formatDate = (dateString: string, timezone?: string): string => {
  try {
    // Bare ISO dates (YYYY-MM-DD) must NOT be parsed through new Date().
    // Date() interprets them as UTC midnight; timezone-formatting then shifts
    // to the previous day west of UTC. A calendar date has no time component
    // — return it unchanged.
    if (BARE_DATE_RE.test(dateString)) {
      return dateString
    }

    // Datetime strings — existing logic unchanged.
    let dateStr = dateString
    if (
      (dateStr.includes('T') || dateStr.includes(' ')) &&
      !dateStr.endsWith('Z') &&
      !dateStr.includes('+')
    ) {
      dateStr = dateStr.replace(' ', 'T') + 'Z'
    }

    const d = new Date(dateStr)

    // Format date using timezone if provided
    if (timezone) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timezone,
      })
      const parts = formatter.formatToParts(d)
      const year = parts.find((p) => p.type === 'year')?.value || ''
      const month = parts.find((p) => p.type === 'month')?.value || ''
      const day = parts.find((p) => p.type === 'day')?.value || ''
      return `${year}-${month}-${day}`
    }

    return d.toISOString().split('T')[0]
  } catch {
    return dateString
  }
}

const formatDateTime = (dateString: string, timezone?: string): string => {
  try {
    // Append Z if missing to ensure UTC parsing
    let dateStr = dateString
    if (
      (dateStr.includes('T') || dateStr.includes(' ')) &&
      !dateStr.endsWith('Z') &&
      !dateStr.includes('+')
    ) {
      dateStr = dateStr.replace(' ', 'T') + 'Z'
    }

    const d = new Date(dateStr)

    // Format datetime using timezone if provided
    if (timezone) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: timezone,
      })
      const parts = formatter.formatToParts(d)
      const year = parts.find((p) => p.type === 'year')?.value || ''
      const month = parts.find((p) => p.type === 'month')?.value || ''
      const day = parts.find((p) => p.type === 'day')?.value || ''
      const hour = parts.find((p) => p.type === 'hour')?.value || ''
      const minute = parts.find((p) => p.type === 'minute')?.value || ''
      const second = parts.find((p) => p.type === 'second')?.value || ''
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`
    }

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  } catch {
    return dateString
  }
}

// Draw a checkmark like the Figma (so we don't depend on ✓ glyph)
const drawCheck = (doc: jsPDF, x: number, y: number, size = 3) => {
  doc.setLineWidth(0.6)
  // y is baseline-ish for text, so push the mark down slightly
  const y0 = y - 1
  doc.line(x, y0, x + size * 0.45, y0 + size * 0.55)
  doc.line(x + size * 0.45, y0 + size * 0.55, x + size * 1.2, y0 - size * 0.35)
  doc.setLineWidth(0.2)
}

export function generatePaymentReceiptPDF(data: PaymentReceiptData): void {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  // Load Noto Sans font if available (critical for ₴ symbol support)
  loadNotoSansFont(doc)

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // Layout tuned to match the screenshot
  const marginX = 18
  const xLabel = marginX
  const xValue = 74
  const xRight = pageW - marginX

  // Typography
  const fsTitle = 22
  const fsSection = 11
  const fsBody = 9
  const fsFooter = 8

  // Colors
  const TEXT: [number, number, number] = [0, 0, 0]
  const MUTED: [number, number, number] = [120, 120, 120]
  const LINE: [number, number, number] = [235, 235, 235]
  const BOX: [number, number, number] = [225, 225, 225]
  const FOOTER: [number, number, number] = [150, 150, 150]

  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2])

  // Helper to safely set font (fallback to helvetica if NotoSans not available)
  // Must be declared before first use
  const safeSetFont = (style: 'normal' | 'bold' = 'normal') => {
    try {
      const fonts = doc.getFontList()
      if ('NotoSans' in fonts) {
        doc.setFont('NotoSans', style)
      } else {
        doc.setFont('helvetica', style)
      }
    } catch {
      doc.setFont('helvetica', style)
    }
  }

  // IMPORTANT: Try to use Noto Sans font, but fall back gracefully if not available
  // Default fonts (helvetica, times, courier) do NOT support ₴ Unicode character
  // The symbol will only display if Noto Sans (or another Unicode font) is loaded
  try {
    const fonts = doc.getFontList()
    if ('NotoSans' in fonts) {
      safeSetFont('normal')
    } else {
      // Fallback to helvetica (₴ will not display, will use "UAH" fallback in renderCurrency)
      doc.setFont('helvetica', 'normal')
    }
  } catch {
    doc.setFont('helvetica', 'normal')
  }

  const hr = (x1: number, y: number, x2: number) => {
    setDraw(LINE)
    doc.line(x1, y, x2, y)
    setDraw([0, 0, 0])
  }

  const section = (title: string, y: number) => {
    doc.setFontSize(fsSection)
    safeSetFont('bold')
    setText(MUTED)
    doc.text(title, xLabel, y)

    const w = doc.getTextWidth(title)
    // line should sit slightly above baseline like the template
    hr(xLabel + w + 6, y - 2.2, xRight)

    setText(TEXT)
    safeSetFont('normal')
  }

  const kv = (
    label: string,
    value: string,
    y: number,
    opts?: {
      labelMuted?: boolean
      valueBold?: boolean
      valueMaxWidth?: number
      isCurrency?: boolean
    }
  ) => {
    doc.setFontSize(fsBody)

    // label
    safeSetFont('normal')
    setText(opts?.labelMuted === false ? TEXT : MUTED)
    doc.text(label, xLabel, y)

    // value
    setText(TEXT)
    safeSetFont(opts?.valueBold === false ? 'normal' : 'bold')

    // If it's currency, use special rendering to ensure symbol displays
    if (opts?.isCurrency || value.includes('₴')) {
      if (opts?.valueMaxWidth) {
        renderCurrency(doc, value, xValue, y, { maxWidth: opts.valueMaxWidth })
      } else {
        renderCurrency(doc, value, xValue, y)
      }
    } else {
      if (opts?.valueMaxWidth) {
        doc.text(value, xValue, y, { maxWidth: opts.valueMaxWidth })
      } else {
        doc.text(value, xValue, y)
      }
    }
    safeSetFont('normal')
  }

  let y = 18

  // ===== Header =====
  doc.setFontSize(fsTitle)
  safeSetFont('bold')
  setText(TEXT)
  doc.text('Payment Receipt', xLabel, y)

  const companyName = data.companyName || '-'
  doc.setFontSize(fsBody + 1)
  safeSetFont('bold')
  doc.text(companyName, xRight, y, { align: 'right' })
  doc.setFont('NotoSans', 'normal')

  y += 16

  // ===== Top key-values (match punctuation from screenshot) =====
  kv('Receipt #', data.receiptNumber, y)
  y += 6
  kv('Payment ID:', data.paymentId, y)
  y += 6
  kv('Date Issued:', formatDate(data.dateIssued, data.userTimezone), y)
  y += 12

  // ===== Client Information =====
  section('Client Information', y)
  y += 8
  kv('Name:', data.clientName, y)
  y += 6
  kv('Client ID:', `#${data.clientId}`, y)
  y += 6
  kv('Phone:', data.phone, y)
  y += 6
  kv('Contract:', data.contract, y)
  y += 12

  // ===== Payment Details =====
  section('Payment Details', y)
  y += 8
  kv('Payment Date:', formatDate(data.paymentDate, data.userTimezone), y)
  y += 6
  kv('Payment Method:', data.paymentMethod, y)
  y += 6
  kv('Transaction Ref:', data.transactionRef, y)
  y += 12

  // ===== Payment Amount =====
  section('Payment Amount', y)
  y += 8
  // In template, label is muted and value is regular bold-ish
  kv('Payment Received', formatCurrency(data.paymentAmount), y, {
    valueBold: true,
    isCurrency: true,
  })
  y += 14

  // ===== Debt Summary =====
  section('Debt Summary', y)
  y += 10

  // Right box geometry (move it more to the right, and keep left text from overlapping)
  const boxW = 96
  const boxX = xRight - boxW
  const boxPadX = 8
  const boxValueX = boxX + boxW - boxPadX
  const boxLabelX = boxX + boxPadX
  const boxRowH = 8
  const rows = 3

  const leftMaxWidth = boxX - 6 - xValue // prevent overlap into the box

  const leftStartY = y

  if (data.daysPastDue !== undefined) {
    kv('Days Past Due:', String(data.daysPastDue), y)
    y += 8
  }

  kv('Status:', String(data.status).toUpperCase(), y)
  y += 6

  if (String(data.status).toUpperCase() === 'ACTIVE') {
    doc.setFontSize(fsBody - 0.5)
    safeSetFont('normal')
    setText(MUTED)
    // wrap inside the left column area (no overlap into box)
    doc.text('(Outstanding debt remains)', xValue, y, { maxWidth: leftMaxWidth })
    setText(TEXT)
    y += 7
  }

  const leftEndY = y

  // Box should align vertically with the left column start, like the template
  const boxTopY = leftStartY - 3
  const boxH = rows * boxRowH + 8

  setDraw(BOX)
  doc.rect(boxX, boxTopY, boxW, boxH)
  setDraw([0, 0, 0])

  const boxRow = (i: number, label: string, value: string) => {
    const yy = boxTopY + 8 + i * boxRowH
    doc.setFontSize(fsBody)
    setText(TEXT)

    safeSetFont('normal')
    // keep label on left, avoid running under the right-aligned value
    doc.text(label, boxLabelX, yy, { maxWidth: boxW - boxPadX * 2 - 32 })

    safeSetFont('bold')
    // Use special currency rendering for values with ₴ symbol
    if (value.includes('₴')) {
      // For right-aligned currency, we need to calculate position
      const currencyText = value
      const textWidth = doc.getTextWidth(currencyText) || 20 // fallback
      const startX = boxValueX - textWidth
      renderCurrency(doc, currencyText, startX, yy)
    } else {
      doc.text(value, boxValueX, yy, { align: 'right' })
    }

    if (i < rows - 1) hr(boxX, yy + 3.3, boxX + boxW)
  }

  // boxRow(0, 'Outstanding Balance Before:', formatCurrency(data.outstandingBalanceBefore))
  // paymentApplied is already negative, so format it directly (will show "- ₴ amount")
  boxRow(1, 'Payment Applied:', formatCurrency(data.paymentApplied))
  // boxRow(2, 'Remaining Balance:', formatCurrency(data.remainingBalance))

  y = Math.max(leftEndY, boxTopY + boxH) + 12

  // ===== Verification =====
  section('Verification', y)
  y += 8
  kv('Received by:', data.receivedBy, y)
  y += 6

  if (data.verifiedBy) {
    kv('Verified by:', data.verifiedBy, y)
    y += 6
  }

  if (data.verifiedOn) {
    kv('Verified on:', formatDateTime(data.verifiedOn, data.userTimezone), y)
    y += 6
  }

  // Status line (black, with drawn check)
  doc.setFontSize(fsBody)
  doc.setFont('NotoSans', 'normal')
  setText(MUTED)
  doc.text('Status:', xLabel, y)

  setText(TEXT)
  drawCheck(doc, xValue, y, 3.2)

  safeSetFont('bold')
  doc.text('VERIFIED AND APPLIED', xValue + 6, y)
  doc.setFont('NotoSans', 'normal')
  y += 14

  // ===== Company Information =====
  section('Company Information', y)
  y += 8

  doc.setFontSize(fsBody)
  doc.setFont('NotoSans', 'normal')
  setText(TEXT)
  doc.text(`${companyName} Department`, xLabel, y)
  y += 8

  const address = data.companyAddress || '-'
  const phone = data.companyPhone || '-'
  const email = data.companyEmail || '-'

  kv('Address:', address, y)
  y += 6
  kv('Phone:', phone, y)
  y += 6
  kv('Email:', email, y)
  y += 6

  // ===== Footer =====
  doc.setFontSize(fsFooter)
  doc.setFont('NotoSans', 'normal')
  setText(FOOTER)
  doc.text(
    `Generated: ${formatDateTime(new Date().toISOString(), data.userTimezone)}`,
    xRight,
    pageH - marginX,
    {
      align: 'right',
    }
  )
  setText(TEXT)

  doc.save(`Payment_Receipt_${data.receiptNumber}.pdf`)
}
