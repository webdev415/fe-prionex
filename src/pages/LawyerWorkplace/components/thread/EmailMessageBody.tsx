import { cn } from '@/lib/utils'
import { sanitizeEmailHtmlForDisplay } from '@/features/lawyerWorkplace/utils/emailHtml'
import type { ThreadMessageBodyFormat } from '../../types'
import { piiProps } from '@/lib/openreplay/pii'

export interface EmailMessageBodyProps {
  body: string
  bodyFormat: ThreadMessageBodyFormat
  className?: string
}

export function EmailMessageBody({ body, bodyFormat, className }: EmailMessageBodyProps) {
  const trimmed = body.trim()
  if (!trimmed) return null

  if (bodyFormat === 'html') {
    const safeHtml = sanitizeEmailHtmlForDisplay(trimmed)
    return (
      <div
        className={cn(
          'email-message-body text-foreground max-w-none overflow-x-auto text-[13px] leading-relaxed break-words',
          '[&_a]:text-secondary-700 [&_a]:underline [&_img]:max-h-64 [&_img]:max-w-full [&_table]:max-w-full',
          className
        )}
        // Backend bleaches HTML on ingest; sanitize again before rendering.
        dangerouslySetInnerHTML={{ __html: safeHtml }}
        // 🔴 The whole letter, from or to a client. `dangerouslySetInnerHTML` is
        // a sink the static audit treats as unmaskable by default: nothing it
        // renders has an identifier, so the ONLY way to cover it is an attribute
        // on the sink itself or an ancestor. Inheritance then covers every text
        // node the HTML produces.
        {...piiProps}
      />
    )
  }

  return (
    <p
      className={cn(
        'text-foreground overflow-wrap-anywhere text-[13px] leading-relaxed break-words whitespace-pre-wrap',
        className
      )}
      {...piiProps}
    >
      {trimmed}
    </p>
  )
}
