import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'

// Context to pass the search query down to SelectItem
const SelectSearchContext = React.createContext<string>('')

/** Plain text from item children for client-side filtering (handles i18n, fragments, etc.). */
function getItemFilterText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getItemFilterText).join(' ')
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode }
    if (props.children != null) return getItemFilterText(props.children)
  }
  return ''
}

// Context to pass the opt-in clear callback down to the trigger. The × on the
// trigger only renders when onClear is provided AND a value is selected, so
// other usages of Select (no onClear) are completely unaffected.
type SelectClearContextValue = {
  onClear?: () => void
  hasValue: boolean
}
const SelectClearContext = React.createContext<SelectClearContextValue>({
  hasValue: false,
})

const Select = ({
  onClear,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root> & { onClear?: () => void }) => {
  const hasValue = props.value !== undefined && props.value !== ''
  return (
    <SelectClearContext.Provider value={{ onClear, hasValue }}>
      <SelectPrimitive.Root {...props}>{children}</SelectPrimitive.Root>
    </SelectClearContext.Provider>
  )
}
Select.displayName = 'Select'

const SelectGroup = SelectPrimitive.Group

const SelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ className, style, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn('text-foreground text-sm font-light', className)}
    style={style}
    {...props}
  />
))
SelectValue.displayName = SelectPrimitive.Value.displayName

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, style, ...props }, ref) => {
  const { onClear, hasValue } = React.useContext(SelectClearContext)
  const showClear = !!onClear && hasValue && !props.disabled

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'ring-offset-background data-[placeholder]:text-muted-foreground text-foreground bg-input flex h-[45px] w-full items-center justify-between rounded-lg border border-gray-400 px-3 py-2 text-sm font-light whitespace-nowrap shadow-none focus:ring-0 focus:outline-none disabled:opacity-50 [&>span]:line-clamp-1',
        props.disabled ? 'cursor-default' : 'cursor-pointer',
        className
      )}
      style={style}
      {...props}
    >
      {children}
      <div className="ml-2 flex shrink-0 items-center gap-1">
        {showClear && (
          <span
            role="button"
            aria-label="Clear"
            tabIndex={-1}
            // Stop pointerdown so Radix doesn't open the menu on the same click.
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClear?.()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onClear?.()
              }
            }}
            className="text-muted-foreground hover:text-foreground flex items-center"
          >
            <Icons.Cancel01 size={14} />
          </span>
        )}
        <div className="opacity-50">
          <Icons.ArrowDown size={16} className="text-current" />
        </div>
      </div>
    </SelectPrimitive.Trigger>
  )
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <Icons.ArrowUp size={16} />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <Icons.ArrowDown size={16} />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    searchable?: boolean
    searchPlaceholder?: string
  }
>(
  (
    {
      className,
      children,
      position = 'popper',
      searchable,
      searchPlaceholder = 'Search...',
      onCloseAutoFocus,
      ...props
    },
    ref
  ) => {
    const [query, setQuery] = React.useState('')

    const clearSearch = React.useCallback(() => {
      setQuery('')
    }, [])

    // Radix unmounts content when closed — reset filter each time the menu opens
    React.useLayoutEffect(() => {
      setQuery('')
    }, [])

    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          className={cn(
            'text-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 border-border bg-card relative z-[200] min-w-[8rem] origin-[--radix-select-content-transform-origin] rounded-md border shadow-md',
            position === 'popper' &&
              'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
            className
          )}
          position={position}
          onCloseAutoFocus={(e) => {
            clearSearch()
            onCloseAutoFocus?.(e)
          }}
          {...props}
        >
          {searchable && (
            <div className="border-border flex items-center border-b px-2 py-1.5">
              <Icons.Search size={14} className="text-muted-foreground mr-2 shrink-0" />
              <input
                className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-sm font-light outline-none"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-muted-foreground hover:text-foreground ml-1 shrink-0"
                >
                  <Icons.Cancel01 size={12} />
                </button>
              )}
            </div>
          )}
          <SelectPrimitive.Viewport
            className={cn(
              position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]'
            )}
          >
            <SelectSearchContext.Provider value={query}>
              <div className="select-scrollbar max-h-64 overflow-y-auto p-1">{children}</div>
            </SelectSearchContext.Provider>
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    )
  }
)
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-sm font-semibold', className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, textValue, style, ...props }, ref) => {
  const query = React.useContext(SelectSearchContext)

  // Filter: HIDE (not unmount) items whose visible text doesn't match the
  // search query. Returning null here would unmount items on each keystroke,
  // which makes Radix re-assert focus over its changed item collection and
  // steals focus from the search input (focus lost after the 1st char —
  // KAN-545). Keeping items mounted with display:none keeps the collection
  // stable, so the search input retains focus.
  const hidden =
    !!query.trim() &&
    !(textValue ?? getItemFilterText(children))
      .trim()
      .toLowerCase()
      .includes(query.toLowerCase().trim())

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'text-foreground focus:bg-muted relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm font-light outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      style={hidden ? { ...style, display: 'none' } : style}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Icons.Checkmark size={16} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
})
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('bg-muted -mx-1 my-1 h-px', className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
