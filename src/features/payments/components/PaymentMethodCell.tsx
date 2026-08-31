/**
 * Method column for the payment tables.
 *
 * EasyPay rows carry two facts — the generic method (always "Online payment")
 * and the service the payer chose. Concatenating them onto one line overflowed
 * the narrow column and wrapped across four lines, so the wallet goes on its
 * own muted second line instead, kept unbreakable so "Google Pay" cannot split.
 */
interface PaymentMethodCellProps {
  /** Already-localised generic method, e.g. "Online payment". */
  baseLabel: string
  /** card | google_pay | apple_pay, or null for non-EasyPay rows. */
  easypayMethod?: string | null
  t: (key: string, options?: { defaultValue?: string }) => string
}

const FALLBACK_LABELS: Record<string, string> = {
  card: 'Card',
  google_pay: 'Google Pay',
  apple_pay: 'Apple Pay',
}

export function PaymentMethodCell({ baseLabel, easypayMethod, t }: PaymentMethodCellProps) {
  if (!easypayMethod) return <>{baseLabel}</>

  const label = t(`pages.clients.detail.easypayMethods.${easypayMethod}`, {
    defaultValue: FALLBACK_LABELS[easypayMethod] ?? easypayMethod,
  })

  return (
    <>
      <span className="block">{baseLabel}</span>
      <span className="text-muted-foreground block text-[11px] leading-tight whitespace-nowrap">
        {label}
      </span>
    </>
  )
}
