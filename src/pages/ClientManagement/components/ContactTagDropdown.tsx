import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { getErrorMessage } from '@/lib/errors'
import { useContactTags, useSetContactTags } from '@/features/contactTags/hooks/useContactTags'
import type { ContactTagAssignmentCategory } from '@/features/contactTags/types'
import { cn } from '@/lib/utils'
import { useHasPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'

// Stable data attributes used for outside-press zone detection
const ATTR_DROPDOWN = 'data-ctd-dropdown'
const ATTR_FLYOUT = 'data-ctd-flyout'
const ATTR_TRIGGER = 'data-ctd-trigger'

interface Props {
  clientId: number
  contactId: number
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  'data-testid'?: string
}

export function ContactTagDropdown({
  clientId,
  contactId,
  isOpen,
  onOpen,
  onClose,
  'data-testid': dataTestId,
}: Props) {
  const { t } = useTranslation('common')
  const hasProtectedPermission = useHasPermission(PERMISSIONS.CONTACT_TAGS.ASSIGN_PROTECTED)

  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null)
  const [flyoutAnchorEl, setFlyoutAnchorEl] = useState<Element | null>(null)
  const [pendingCategoryId, setPendingCategoryId] = useState<number | null>(null)

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => (open ? onOpen() : onClose()),
    placement: 'bottom-start',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  const { refs: flyoutRefs, floatingStyles: flyoutStyles } = useFloating({
    open: hoveredCategoryId !== null,
    placement: 'right-start',
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    elements: { reference: flyoutAnchorEl },
    whileElementsMounted: autoUpdate,
  })

  const click = useClick(context)
  // Disable Floating UI's built-in outside press; we handle it manually below
  const dismiss = useDismiss(context, { outsidePress: false })
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss])

  const { data: categories = [], isLoading } = useContactTags(clientId, contactId, isOpen)
  const { mutateAsync: setTags } = useSetContactTags(clientId, contactId)

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep a stable ref to onClose so the effect never re-registers due to parent re-renders
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Outside-press: close only when the pointer lands outside the trigger, dropdown, and flyout.
  // Uses element.closest() on data attributes — no ref timing dependency.
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (
        target?.closest(`[${ATTR_TRIGGER}]`) ||
        target?.closest(`[${ATTR_DROPDOWN}]`) ||
        target?.closest(`[${ATTR_FLYOUT}]`)
      )
        return
      onCloseRef.current()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setHoveredCategoryId(null)
      setFlyoutAnchorEl(null)
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current)
        openTimerRef.current = null
      }
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const handleCategoryEnter = useCallback(
    (categoryId: number, el: Element) => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      if (hoveredCategoryId !== null) {
        setHoveredCategoryId(categoryId)
        setFlyoutAnchorEl(el)
      } else {
        openTimerRef.current = setTimeout(() => {
          setHoveredCategoryId(categoryId)
          setFlyoutAnchorEl(el)
          openTimerRef.current = null
        }, 200)
      }
    },
    [hoveredCategoryId]
  )

  const handleCategoryLeave = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
    closeTimerRef.current = setTimeout(() => {
      setHoveredCategoryId(null)
      setFlyoutAnchorEl(null)
      closeTimerRef.current = null
    }, 200)
  }, [])

  const handleFlyoutEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const handleFlyoutLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setHoveredCategoryId(null)
      setFlyoutAnchorEl(null)
      closeTimerRef.current = null
    }, 200)
  }, [])

  const handleValueClick = useCallback(
    async (category: ContactTagAssignmentCategory, valueId: number) => {
      if (!category.can_edit || pendingCategoryId !== null) return

      let newValueIds: number[]
      if (category.selection_type === 'single') {
        newValueIds = category.assigned_value_ids.includes(valueId) ? [] : [valueId]
      } else {
        newValueIds = category.assigned_value_ids.includes(valueId)
          ? category.assigned_value_ids.filter((id) => id !== valueId)
          : [...category.assigned_value_ids, valueId]
      }

      setPendingCategoryId(category.category_id)
      try {
        await setTags({ category_id: category.category_id, value_ids: newValueIds })
        toast.success(t('pages.contactTags.saved', 'Tags updated'))
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setPendingCategoryId(null)
      }
    },
    [pendingCategoryId, setTags, t]
  )

  const activeCategory = categories.find((c) => c.category_id === hoveredCategoryId)

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        data-testid={dataTestId}
        {...{ [ATTR_TRIGGER]: '' }}
        {...getReferenceProps()}
        className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
        title={t('pages.contactTags.tags', 'Tags')}
      >
        <Icons.Tag01 size={16} className="flex-shrink-0" />
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...{ [ATTR_DROPDOWN]: '' }}
            {...getFloatingProps()}
            className="border-border bg-card z-50 w-64 rounded-lg border py-1 shadow-lg"
          >
            {isLoading ? (
              <p className="text-muted-foreground px-3 py-2 text-sm">
                {t('common.loading', 'Loading...')}
              </p>
            ) : categories.length === 0 ? (
              <p className="text-muted-foreground px-3 py-2 text-sm">
                {t('pages.contactTags.noCategories', 'No tag categories available')}
              </p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.category_id}
                  className={cn(
                    'flex cursor-default items-start gap-2 px-3 py-2 text-sm',
                    hoveredCategoryId === category.category_id && 'bg-muted'
                  )}
                  onMouseEnter={(e) => handleCategoryEnter(category.category_id, e.currentTarget)}
                  onMouseLeave={handleCategoryLeave}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-foreground text-sm font-medium">
                        {category.category_name}
                      </span>
                      {category.is_system && (
                        <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {t('pages.contactTags.readOnly', 'Read only')}
                        </span>
                      )}
                      {category.is_protected && !hasProtectedPermission && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {t('pages.contactTags.protected', 'Protected')}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {category.selection_type === 'multi'
                        ? t('pages.contactTags.multiSelectHint', 'Select one or more values')
                        : t(
                            'pages.contactTags.singleSelectHint',
                            'Select one value, or clear to remove'
                          )}
                    </p>
                  </div>
                  <Icons.ArrowRight size={12} className="text-muted-foreground mt-1 shrink-0" />
                </div>
              ))
            )}
          </div>

          {hoveredCategoryId !== null && activeCategory && (
            <div
              ref={flyoutRefs.setFloating}
              style={flyoutStyles}
              {...{ [ATTR_FLYOUT]: '' }}
              className="border-border bg-card z-50 w-52 rounded-lg border p-1.5 shadow-lg"
              onMouseEnter={handleFlyoutEnter}
              onMouseLeave={handleFlyoutLeave}
            >
              {activeCategory.values.length === 0 ? (
                <p className="text-muted-foreground px-2 py-1.5 text-xs">
                  {t('pages.contactTags.noValues', 'No values available')}
                </p>
              ) : (
                activeCategory.values.map((value) => {
                  const isAssigned = activeCategory.assigned_value_ids.includes(value.id)
                  const isPending = pendingCategoryId !== null
                  const canEdit = activeCategory.can_edit
                  const isSingle = activeCategory.selection_type === 'single'
                  return (
                    <button
                      key={value.id}
                      type="button"
                      disabled={!canEdit || isPending}
                      onClick={() => handleValueClick(activeCategory, value.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                        canEdit && !isPending && 'hover:bg-muted cursor-pointer',
                        !canEdit && 'cursor-default opacity-40',
                        canEdit && isPending && 'cursor-wait opacity-60'
                      )}
                    >
                      {isSingle ? (
                        <div
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                            isAssigned
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-muted-foreground'
                          )}
                        >
                          {isAssigned && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
                            isAssigned
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-muted-foreground'
                          )}
                        >
                          {isAssigned && (
                            <Icons.Tick01 size={10} className="text-white" strokeWidth={3} />
                          )}
                        </div>
                      )}
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: value.color || '#64748b' }}
                      />
                      <span className="text-foreground truncate text-xs">{value.name}</span>
                      {value.blocks_calls && (
                        <span
                          className="ml-auto shrink-0"
                          title={t('pages.contactTags.blocksCalls', 'Blocks calls')}
                        >
                          <Icons.CallEnd size={11} className="text-error-500" />
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </FloatingPortal>
      )}
    </>
  )
}
