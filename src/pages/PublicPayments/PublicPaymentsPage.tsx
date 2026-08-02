/**
 * Public EasyPay payment portal page.
 *
 * Embedded/linked from techno-finance.com ("Factoring" tab). Public — no CRM
 * auth. Flow:
 *   1. Visitor enters TIN + Credit Agreement Number.
 *   2. Data is validated against Prionex (`easypayApi.validateCredit`).
 *   3. Three outcomes:
 *        - not_found → inline error message
 *        - closed    → "Debt #N is closed" + "Check again"
 *        - open      → amount modal (cap 29 999 UAH) → redirect to EasyPay
 *   4. EasyPay later posts a callback to Prionex, which records the
 *      transaction in Payment History (Pending / Declined / Credited).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Input, Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui'
import { Icon, Alert02Icon, CheckmarkCircle02Icon, Wallet01Icon } from '@/lib/icons'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { easypayApi, EasyPayApiError } from '@/features/easypay'
import type {
  ValidateCreditOpenResponse,
  ValidateCreditResponse,
} from '@/features/easypay/api/types'
import { EASYPAY_MAX_AMOUNT_UAH } from './constants'

/** Normalise a user-typed amount ("1 234,50") to a parseable string ("1234.50"). */
function normaliseAmountInput(raw: string): string {
  return raw.replace(/\s/g, '').replace(',', '.')
}

type CreditResult = Exclude<ValidateCreditResponse, ValidateCreditOpenResponse> | null

export function PublicPaymentsPage() {
  const { t } = useTranslation('easypay')

  // Form state
  const [tin, setTin] = useState('')
  const [contractNumber, setContractNumber] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Non-open validation outcome (not_found / closed) rendered below the form.
  const [creditResult, setCreditResult] = useState<CreditResult>(null)

  // Open-credit → amount entry modal state
  const [openCredit, setOpenCredit] = useState<ValidateCreditOpenResponse | null>(null)
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [isInitiating, setIsInitiating] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  const canSubmit = tin.trim().length > 0 && contractNumber.trim().length > 0 && !isValidating

  /** Effective ceiling for the amount input (min of 29 999 and remaining debt). */
  const maxAmount = useMemo(() => {
    if (!openCredit) return EASYPAY_MAX_AMOUNT_UAH
    const parsed = Number(openCredit.max_payment_amount)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : EASYPAY_MAX_AMOUNT_UAH
  }, [openCredit])

  const resetOutcome = () => {
    setCreditResult(null)
    setFormError(null)
  }

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    resetOutcome()
    setIsValidating(true)
    try {
      const result = await easypayApi.validateCredit({
        tin: tin.trim(),
        contract_number: contractNumber.trim(),
      })

      if (result.status === 'open') {
        setOpenCredit(result)
        setAmount('')
        setAmountError(null)
      } else {
        setCreditResult(result)
      }
    } catch (err) {
      const message =
        err instanceof EasyPayApiError && err.status === 401
          ? t('errors.portalNotConfigured')
          : t('errors.generic')
      setFormError(message)
    } finally {
      setIsValidating(false)
    }
  }

  const handleCheckAgain = () => {
    resetOutcome()
    setTin('')
    setContractNumber('')
  }

  const closeAmountModal = () => {
    if (isInitiating || isRedirecting) return
    setOpenCredit(null)
    setAmount('')
    setAmountError(null)
  }

  const validateAmount = (value: string): { ok: true; amount: number } | { ok: false } => {
    const parsed = Number(normaliseAmountInput(value))
    if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setAmountError(t('amount.errorInvalid'))
      return { ok: false }
    }
    if (parsed > maxAmount) {
      setAmountError(t('amount.errorExceeds', { max: formatMoneyUAHTwoDecimals(maxAmount) }))
      return { ok: false }
    }
    setAmountError(null)
    return { ok: true, amount: parsed }
  }

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!openCredit || isInitiating || isRedirecting) return

    const check = validateAmount(amount)
    if (!check.ok) return

    setIsInitiating(true)
    try {
      const { redirect_url } = await easypayApi.initiatePayment({
        tin: tin.trim(),
        contract_number: openCredit.contract_number,
        amount: check.amount.toFixed(2),
      })
      // Hand the browser off to the EasyPay checkout page.
      setIsRedirecting(true)
      window.location.assign(redirect_url)
    } catch (err) {
      // 400 = amount rejected server-side (limit / exceeds remaining); surface detail.
      const message =
        err instanceof EasyPayApiError && err.status === 400
          ? err.detail || t('amount.errorExceeds', { max: formatMoneyUAHTwoDecimals(maxAmount) })
          : t('errors.generic')
      setAmountError(message)
      setIsInitiating(false)
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card variant="elevated" padding="lg">
          <header className="mb-6 text-center">
            <div className="bg-primary-300/15 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
              <Icon icon={Wallet01Icon} size={28} className="text-primary-300" />
            </div>
            <h1 className="text-foreground text-2xl font-semibold">{t('title')}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{t('subtitle')}</p>
          </header>

          <form onSubmit={handleValidate} noValidate className="space-y-4">
            <Input
              label={t('form.tinLabel')}
              placeholder={t('form.tinPlaceholder')}
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              autoComplete="off"
              inputMode="numeric"
              disabled={isValidating}
              name="tin"
            />
            <Input
              label={t('form.contractLabel')}
              placeholder={t('form.contractPlaceholder')}
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              autoComplete="off"
              disabled={isValidating}
              name="contract_number"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!canSubmit}
              isLoading={isValidating}
            >
              {t('form.submit')}
            </Button>
          </form>

          {formError && (
            <p role="alert" className="text-error-500 mt-4 text-center text-sm">
              {formError}
            </p>
          )}

          {creditResult?.status === 'not_found' && (
            <div
              role="alert"
              className="border-error-500 bg-error-950/40 text-error-300 mt-5 rounded-lg border p-4 text-sm"
            >
              <div className="flex items-start gap-2">
                <Icon icon={Alert02Icon} size={18} className="mt-0.5 flex-shrink-0" />
                <span>{t('result.notFound')}</span>
              </div>
            </div>
          )}

          {creditResult?.status === 'closed' && (
            <div className="mt-5 space-y-3">
              <div
                role="status"
                className="border-success-500 bg-success-950/40 text-success-300 rounded-lg border p-4 text-sm"
              >
                <div className="flex items-start gap-2">
                  <Icon icon={CheckmarkCircle02Icon} size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{t('result.closed', { number: creditResult.contract_number })}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="white-secondary"
                size="lg"
                className="w-full"
                onClick={handleCheckAgain}
              >
                {t('result.checkAgain')}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Scenario 3: credit is open → enter payment amount */}
      <Modal open={!!openCredit} onClose={closeAmountModal} maxWidth="sm">
        <ModalHeader
          icon={<Icon icon={Wallet01Icon} size={22} className="text-primary-300" />}
          title={t('amount.title')}
        />
        <form onSubmit={handleProceedToPayment} noValidate>
          <ModalContent>
            {openCredit && (
              <div className="space-y-4">
                <dl className="text-muted-foreground space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt>{t('amount.contract')}</dt>
                    <dd className="text-foreground font-medium">{openCredit.contract_number}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>{t('amount.remaining')}</dt>
                    <dd className="text-foreground font-medium">
                      {formatMoneyUAHTwoDecimals(openCredit.remaining_debt_amount)}
                    </dd>
                  </div>
                </dl>

                <Input
                  label={t('amount.label')}
                  placeholder={t('amount.placeholder')}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    if (amountError) setAmountError(null)
                  }}
                  inputMode="decimal"
                  disabled={isInitiating || isRedirecting}
                  error={amountError ?? undefined}
                  helperText={t('amount.maxHint', {
                    max: formatMoneyUAHTwoDecimals(maxAmount),
                  })}
                  name="amount"
                />
              </div>
            )}
          </ModalContent>
          <ModalFooter>
            <Button
              type="button"
              variant="cancel"
              size="md"
              onClick={closeAmountModal}
              disabled={isInitiating || isRedirecting}
            >
              {t('amount.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isInitiating || isRedirecting}
              disabled={isInitiating || isRedirecting}
            >
              {t('amount.pay')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}

export default PublicPaymentsPage
