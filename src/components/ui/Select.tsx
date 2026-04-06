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

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ className, style, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn('text-dark-500 text-sm font-light', className)}
    style={style}
    {...props}
  />
))
SelectValue.displayName = SelectPrimitive.Value.displayName

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, style, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'ring-offset-background data-[placeholder]:text-muted-foreground text-dark-500 flex h-[45px] w-full items-center justify-between rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light whitespace-nowrap shadow-none focus:ring-0 focus:outline-none disabled:opacity-50 [&>span]:line-clamp-1',
      props.disabled ? 'cursor-default' : 'cursor-pointer',
      className
    )}
    style={style}
    {...props}
  >
    {children}
    <div className="opacity-50">
      <Icons.ArrowDown size={16} className="text-current" />
    </div>
  </SelectPrimitive.Trigger>
))
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
            'text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-[200] min-w-[8rem] origin-[--radix-select-content-transform-origin] rounded-md border bg-white shadow-md',
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
            <div className="flex items-center border-b border-gray-200 px-2 py-1.5">
              <Icons.Search size={14} className="mr-2 shrink-0 text-gray-400" />
              <input
                className="text-dark-500 w-full bg-transparent text-sm font-light outline-none placeholder:text-gray-400"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // Prevent Radix from intercepting key events and navigating items
                onKeyDown={(e) => e.stopPropagation()}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="ml-1 shrink-0 text-gray-400 hover:text-gray-600"
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
              <div className="select-scrollbar max-h-64 overflow-y-scroll p-1">{children}</div>
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
>(({ className, children, textValue, ...props }, ref) => {
  const query = React.useContext(SelectSearchContext)

  // Filter: hide item if search query doesn't match visible text
  if (query.trim()) {
    const text = (textValue ?? getItemFilterText(children)).trim()
    if (!text.toLowerCase().includes(query.toLowerCase().trim())) {
      return null
    }
  }

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'text-dark-500 relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm font-light outline-none select-none focus:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
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
