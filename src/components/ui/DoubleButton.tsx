/* eslint-disable react-refresh/only-export-components */
import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const doubleButtonVariants = cva(
  'group flex items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      size: {
        sm: 'h-10',
        md: 'h-12',
        lg: 'h-14',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

const iconContainerVariants = cva(
  'flex items-center justify-center rounded-full transition-colors',
  {
    variants: {
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
      },
      iconPosition: {
        left: 'ml-1',
        right: 'mr-1',
      },
    },
    defaultVariants: {
      size: 'md',
      iconPosition: 'left',
    },
  }
)

const textContainerVariants = cva('px-4 py-3 text-sm font-medium transition-colors', {
  variants: {
    size: {
      sm: 'px-3 py-2 text-xs',
      md: 'px-4 py-3 text-sm',
      lg: 'px-6 py-4 text-base',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})

export interface DoubleButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof doubleButtonVariants> {
  asChild?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  iconSize?: number
  iconPosition?: 'left' | 'right'
}

const DoubleButton = forwardRef<HTMLButtonElement, DoubleButtonProps>(
  (
    {
      className,
      size,
      asChild = false,
      icon,
      children,
      iconSize: _iconSize,
      iconPosition = 'left',
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'

    // If icon is provided, wrap it to ensure proper styling
    // If no icon provided, render nothing (developer must provide icon)
    const iconElement = icon ? (
      typeof icon === 'object' && 'type' in icon && 'props' in icon ? (
        icon
      ) : (
        <span className="flex items-center justify-center">{icon}</span>
      )
    ) : null

    return (
      <Comp
        className={cn(
          doubleButtonVariants({ size }),
          // Button background colors
          // DEFAULT: bg-secondary-800 (dark green/teal)
          // HOVER: lighter, more vibrant green (bg-secondary-600)
          // DISABLED: bg-gray-200 (light gray)
          'bg-secondary-800 hover:bg-primary-300 hover:text-dark-500 active:bg-primary-500 disabled:bg-gray-200 disabled:text-gray-600',
          className
        )}
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {/* Icon container with circular background - Left position */}
        {iconElement && iconPosition === 'left' && (
          <div
            className={cn(
              iconContainerVariants({ size, iconPosition: 'left' }),
              'bg-primary-300 text-dark-500 group-hover:bg-primary-100 group-active:bg-primary-300 group-disabled:text-dark-500 group-disabled:bg-gray-600',
              '[&_svg]:text-dark-500 group-hover:[&_svg]:text-dark-500 group-disabled:[&_svg]:text-dark-500',
              '[&_span]:text-dark-500 group-hover:[&_span]:text-dark-500 group-disabled:[&_span]:text-dark-500'
            )}
          >
            {iconElement}
          </div>
        )}

        {/* Text container */}
        <span
          className={cn(
            textContainerVariants({ size }),
            'group-hover:text-dark-500 text-white group-disabled:text-gray-600'
          )}
        >
          {children}
        </span>

        {/* Icon container with circular background - Right position */}
        {iconElement && iconPosition === 'right' && (
          <div
            className={cn(
              iconContainerVariants({ size, iconPosition: 'right' }),
              'bg-primary-300 text-dark-500 group-hover:bg-primary-100 group-active:bg-primary-300 group-disabled:text-dark-500 group-disabled:bg-gray-600',
              '[&_svg]:text-dark-500 group-hover:[&_svg]:text-dark-500 group-disabled:[&_svg]:text-dark-500',
              '[&_span]:text-dark-500 group-hover:[&_span]:text-dark-500 group-disabled:[&_span]:text-dark-500'
            )}
          >
            {iconElement}
          </div>
        )}
      </Comp>
    )
  }
)

DoubleButton.displayName = 'DoubleButton'

export { DoubleButton, doubleButtonVariants }
