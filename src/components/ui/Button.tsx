/* eslint-disable react-refresh/only-export-components */
import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-500 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-300 text-dark-500 hover:bg-primary-500 disabled:bg-gray-200 disabled:text-gray-600 active:bg-primary-600',
        secondary:
          'bg-secondary-800 text-white hover:bg-secondary-600 disabled:bg-gray-200 disabled:text-gray-600 active:bg-secondary-900',
        'white-primary':
          'bg-white text-primary-500 hover:bg-primary-500 hover:text-dark-500 disabled:bg-gray-200 disabled:text-gray-600 active:bg-primary-600',
        'white-secondary':
          'bg-white text-secondary-800 hover:bg-secondary-800 hover:text-white disabled:bg-gray-200 disabled:text-gray-600 active:bg-secondary-500',
        'transparent-black':
          'bg-transparent text-dark-500 hover:bg-gray-500 hover:text-white disabled:text-gray-600 active:bg-gray-700',
        light: 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400',
        cancel:
          'bg-gray-500 text-white hover:bg-secondary-800 active:bg-secondary-900 disabled:bg-gray-200 disabled:text-gray-600',
        outline:
          'border border-gray-600 text-dark-500 hover:bg-secondary-800 hover:text-white hover:border-secondary-800 disabled:bg-gray-200 disabled:text-gray-600 disabled:border-gray-600 active:bg-primary-600 active:border-secondary-500 active:bg-secondary-900 active:text-white',
        ghost: 'text-gray-300 hover:bg-dark-300 hover:text-white active:bg-dark-200',
        danger: 'bg-error-500 text-white hover:bg-error-600 active:bg-error-700',
        success: 'bg-success-500 text-white hover:bg-success-600 active:bg-success-700',
      },
      size: {
        // Text + Icons sizes
        '2xs': 'h-6 px-2 text-[10px] gap-1',
        xs: 'h-7 px-3 text-xs gap-1.5',
        sm: 'h-8 px-4 text-xs gap-2',
        md: 'h-10 px-5 text-sm gap-2',
        lg: 'h-12 px-6 text-sm gap-2.5',
        xl: 'h-[45px] px-6',
        // Icon-only sizes (square, no padding)
        'icon-2xs': 'h-6 w-6 p-0',
        'icon-xs': 'h-7 w-7 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-md': 'h-10 w-10 p-0',
        'icon-lg': 'h-12 w-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  iconOnly?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      iconOnly = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'

    // Determine if this should be an icon-only button
    const isIconOnly = iconOnly || (!children && (leftIcon || rightIcon))

    // Map size to icon-only size if needed
    const actualSize =
      isIconOnly && size && typeof size === 'string' && !size.startsWith('icon-')
        ? (`icon-${size}` as typeof size)
        : size

    return (
      <Comp
        className={cn(buttonVariants({ variant, size: actualSize, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className={cn(isIconOnly ? 'h-4 w-4' : 'mr-2 h-4 w-4 animate-spin')}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {!isIconOnly && <span>Loading...</span>}
          </>
        ) : (
          <>
            {leftIcon && <span>{leftIcon}</span>}
            {!isIconOnly && children}
            {rightIcon && <span>{rightIcon}</span>}
            {isIconOnly && !leftIcon && !rightIcon && children}
          </>
        )}
      </Comp>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }
