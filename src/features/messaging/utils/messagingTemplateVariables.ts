import type { MutableRefObject, RefObject } from 'react'

/** Same palette as SMS templates and messaging draft editor (`{{var}}` syntax). */
export const MESSAGING_AVAILABLE_VARIABLES = [
  { name: 'client_name', key: 'clientFirstName' },
  { name: 'debt_amount', key: 'currentDebtAmount' },
  { name: 'operator_name', key: 'operatorName' },
  { name: 'operator_phone', key: 'operatorPhone' },
  { name: 'due_date', key: 'paymentDueDate' },
  { name: 'contract_number', key: 'contractLoanNumber' },
] as const

export type MessagingTemplateFocusField = 'subject' | 'body'

export function insertMessagingVariableAtCursor(params: {
  variableName: string
  subject: string
  body: string
  setSubject: (value: string) => void
  setBody: (value: string) => void
  showSubject: boolean
  subjectRef: RefObject<HTMLInputElement | null>
  bodyRef: RefObject<HTMLTextAreaElement | null>
  lastFocusedRef: MutableRefObject<MessagingTemplateFocusField>
  onInserted?: () => void
}): void {
  const token = `{{${params.variableName}}}`
  const {
    subject,
    body,
    setSubject,
    setBody,
    showSubject,
    subjectRef,
    bodyRef,
    lastFocusedRef,
    onInserted,
  } = params

  if (lastFocusedRef.current === 'subject' && showSubject && subjectRef.current) {
    const input = subjectRef.current
    const start = input.selectionStart ?? subject.length
    const end = input.selectionEnd ?? subject.length
    const next = subject.slice(0, start) + token + subject.slice(end)
    setSubject(next)
    onInserted?.()
    setTimeout(() => {
      input.focus()
      const pos = start + token.length
      input.setSelectionRange(pos, pos)
    }, 0)
    return
  }

  const textarea = bodyRef.current
  if (!textarea) {
    setBody(body + token)
    onInserted?.()
    return
  }

  const start = textarea.selectionStart ?? body.length
  const end = textarea.selectionEnd ?? body.length
  const next = body.slice(0, start) + token + body.slice(end)
  setBody(next)
  onInserted?.()
  setTimeout(() => {
    textarea.focus()
    const pos = start + token.length
    textarea.setSelectionRange(pos, pos)
  }, 0)
}
