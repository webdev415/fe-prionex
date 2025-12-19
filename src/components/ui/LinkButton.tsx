/* eslint-disable react-refresh/only-export-components */
import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const linkButtonVariants = cva(
  'inline-flex items-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none cursor-pointer bg-transparent',
  {
    variants: {
      variant: {
        // Regular Primary: secondary-800 (default), primary-500 (hover), gray-700 (disabled)
        'regular-primary':
          'text-primary-700 hover:text-primary-500 active:text-primary-600 disabled:text-gray-700',

        // Regular Secondary: secondary-800 (default), primary-500 (hover), gray-700 (disabled)
        'regular-secondary':
          'text-secondary-800 hover:text-primary-500 active:text-primary-600 disabled:text-gray-700',

        // Regular Red: error-500 (default), error-700 (hover), gray-700 (disabled)
        'regular-red':
          'text-error-500 hover:text-error-700 active:text-error-800 disabled:text-gray-700',

        // Medium Primary: primary-700 (default), primary-500 (hover), gray-700 (disabled)
        'medium-primary':
          'text-primary-700 hover:text-primary-500 active:text-primary-600 disabled:text-gray-700',

        // Medium Secondary: primary-700 (default), primary-500 (hover), gray-700 (disabled)
        'medium-secondary':
          'text-secondary-800 hover:text-primary-500 active:text-primary-600 disabled:text-gray-700',

        // Medium Red: error-500 (default), error-700 (hover), gray-700 (disabled)
        'medium-red':
          'text-error-500 hover:text-error-700 active:text-error-800 disabled:text-gray-700',
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
