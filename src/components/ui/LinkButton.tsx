/* eslint-disable react-refresh/only-export-components */
import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const linkButtonVariants = cva(
  'inline-flex items-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none cursor-pointer bg-transparent',
  {
    variants: {
      variant: {
        // Use semantic primary (light in dark themes) — primary-600/700 stay dark on dark accents
        'regular-primary':
          'text-primary hover:text-primary/80 active:text-primary/90 disabled:text-muted-foreground',

        'regular-secondary':
          'text-primary hover:text-primary/80 active:text-primary/90 disabled:text-muted-foreground',

        'regular-red':
          'text-error-500 hover:text-error-400 active:text-error-500 disabled:text-muted-foreground',

        'regular-black':
          'text-foreground hover:text-foreground/80 active:text-foreground disabled:text-muted-foreground',

        'regular-gray':
          'text-muted-foreground hover:text-foreground active:text-foreground disabled:text-muted-foreground/60',

        'medium-primary':
          'text-primary hover:text-primary/80 active:text-primary/90 disabled:text-muted-foreground',

        'medium-secondary':
          'text-primary hover:text-primary/80 active:text-primary/90 disabled:text-muted-foreground',

        'medium-red':
          'text-error-500 hover:text-error-400 active:text-error-500 disabled:text-muted-foreground',

        'medium-black':
          'text-foreground hover:text-foreground/80 active:text-foreground disabled:text-muted-foreground',
      },
      size: {
        xs: 'h-8 px-2 text-xs gap-1.5',
        sm: 'h-9 px-3 text-sm gap-2',
        md: 'h-10 px-4 text-sm gap-2',
      },
    },
    defaultVariants: {
      variant: 'regular-primary',
      size: 'sm',
    },
  }
)

export interface LinkButtonProps
  extends
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof linkButtonVariants> {
  asChild?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  children: React.ReactNode
}

const LinkButton = forwardRef<HTMLButtonElement, LinkButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        className={cn(linkButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {/* Left Icon */}
        {leftIcon && (
          <span className="flex items-center justify-center [&_svg]:h-4 [&_svg]:w-4">
            {leftIcon}
          </span>
        )}

        {/* Text Content */}
        <span>{children}</span>

        {/* Right Icon */}
        {rightIcon && (
          <span className="flex items-center justify-center [&_svg]:h-4 [&_svg]:w-4">
            {rightIcon}
          </span>
        )}
      </Comp>
    )
  }
)

LinkButton.displayName = 'LinkButton'

export { LinkButton, linkButtonVariants }
