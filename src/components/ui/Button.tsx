/* eslint-disable react-refresh/only-export-components */
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-300 text-primary-foreground hover:bg-primary-500 disabled:bg-muted disabled:text-muted-foreground active:bg-primary-600',
        secondary:
          'bg-secondary-800 text-white hover:bg-secondary-600 disabled:bg-muted disabled:text-muted-foreground active:bg-secondary-900',
        'white-primary':
          'bg-card text-primary-500 border border-border hover:bg-primary-500 hover:text-primary-foreground disabled:bg-muted disabled:text-muted-foreground active:bg-primary-600 active:text-primary-foreground',
        'white-secondary':
          'bg-card text-foreground border border-border hover:bg-secondary-800 hover:text-white disabled:bg-muted disabled:text-muted-foreground active:bg-secondary-500',
        'transparent-black':
          'bg-transparent text-foreground hover:bg-muted hover:text-foreground disabled:text-muted-foreground active:bg-muted',
        light: 'bg-muted text-foreground hover:bg-muted/80 active:bg-muted',
        cancel:
          'bg-muted text-foreground hover:bg-muted-foreground/20 active:bg-muted-foreground/30 disabled:bg-muted disabled:text-muted-foreground',
        outline:
          'border border-border text-foreground hover:bg-muted hover:text-foreground disabled:bg-muted disabled:text-muted-foreground disabled:border-border active:bg-muted',
        ghost:
          'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted disabled:text-muted-foreground',
        danger:
          'bg-error-500 text-primary-foreground hover:bg-error-600 active:bg-error-700 disabled:bg-muted disabled:text-muted-foreground',
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
    const { t } = useTranslation('common')
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
            {!isIconOnly && <span>{t('common.loading', 'Loading...')}</span>}
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
