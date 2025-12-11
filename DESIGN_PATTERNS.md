# Frontend Design Patterns & Style Guide

**CRM Prionex Frontend - React + TypeScript + Tailwind CSS v4**

This document outlines the design patterns, styling conventions, and best practices for developing frontend components in the Prionex CRM application.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Styling Approach](#styling-approach)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Sizing](#spacing--sizing)
6. [Component Patterns](#component-patterns)
7. [Icon Usage](#icon-usage)
8. [Common Conversions](#common-conversions)
9. [Code Quality](#code-quality)

---

## Core Principles

### 1. Tailwind-First Approach
**Always use Tailwind CSS utility classes. Never use inline styles.**

❌ **Don't do this:**
```tsx
<div style={{ backgroundColor: '#FFFFFF', padding: '24px' }}>
  <h1 style={{ fontSize: '24px', color: '#05040D' }}>Title</h1>
</div>
```

✅ **Do this:**
```tsx
<div className="bg-white p-6">
  <h1 className="text-2xl text-dark-500">Title</h1>
</div>
```

### 2. No Direct Color References
**Never import or use the colors object. Use Tailwind color classes.**

❌ **Don't do this:**
```tsx
import { colors } from '@/lib/colors'

<button style={{ backgroundColor: colors.primary[300] }}>
  <Icons.Add color={colors.neutral.dark[500]} />
</button>
```

✅ **Do this:**
```tsx
<button className="bg-primary-300">
  <Icons.Add className="text-dark-500" />
</button>
```

### 3. Conditional Styling
**Use the `cn()` utility for conditional classes.**

```tsx
import { cn } from '@/lib/utils'

<button
  className={cn(
    'h-12 rounded-full px-6 py-3 text-sm font-medium',
    isActive ? 'bg-primary-300 text-dark-500' : 'bg-gray-200 text-gray-600'
  )}
>
  {label}
</button>
```

---

## Styling Approach

### Tailwind CSS v4 Configuration

This project uses **Tailwind CSS v4** with CSS-first configuration:

- All theme customizations are in `src/index.css` using the `@theme` directive
- JavaScript config (`tailwind.config.ts`) is minimal
- Colors are defined as CSS variables (`--color-*`)

### File Structure

```
src/
├── index.css          # Tailwind configuration with @theme directive
├── components/        # Reusable UI components
│   └── ui/           # Base UI components (Button, Input, Modal, etc.)
├── pages/            # Page-level components
├── features/         # Feature-specific components and logic
└── lib/
    ├── utils.ts      # cn() utility for className merging
    └── icons.ts      # Icon component exports
```

---

## Color System

### Complete Color Palettes

Our design system uses **9 complete color palettes** defined in `src/index.css` using Tailwind v4's `@theme` directive. Each palette has 11 shades (50-950).

| Palette | Main Shade | Hex Code | Usage |
|---------|-----------|----------|-------|
| **PRIMARY** | `primary-500` | `#80D80A` | CTAs, links, focus states, interactive elements (Green) |
| **SECONDARY** | `secondary-500` | `#359791` | Secondary actions, accents (Teal/Blue-Green) |
| **INFORMATION** | `information-500` | `#3B82F6` | Info messages, secondary actions, informational badges (Blue) |
| **DARK** | `dark-500` | `#05040D` | Text, dark backgrounds, headers (Dark Purple/Black) |
| **GRAY** | `gray-500` | `#A1A1A1` | Borders, dividers, disabled states, secondary text (Neutral Gray) |
| **LIGHT** | `light-500` | `#90947B` | Light backgrounds, cards, panels (Grey-Green) |
| **SUCCESS** | `success-500` | `#22C55E` | Success messages, positive feedback, completed states (Green) |
| **WARNING** | `warning-500` | `#EAB308` | Warning messages, caution states, pending actions (Yellow/Orange) |
| **ERROR** | `error-500` | `#EF4444` | Error messages, destructive actions, validation failures (Red) |

### Commonly Used Shades

Based on actual component usage in the codebase:

| Tailwind Class | Hex Code | Common Usage in Codebase |
|---------------|----------|--------------------------|
| `bg-primary-300` | `#BBFB5B` | Bright accent buttons, icon backgrounds |
| `bg-primary-500` | `#80D80A` | Standard primary green |
| `bg-secondary-800` | `#204E4D` | Dark teal backgrounds, primary action buttons |
| `bg-secondary-500` | `#359791` | Standard teal |
| `text-dark-500` | `#05040D` | Main text color, headings |
| `bg-gray-200` | `#DFDFDF` | Light borders, disabled backgrounds |
| `text-gray-500` | `#A1A1A1` | Medium gray text |
| `text-gray-600` | `#888888` | Darker gray text, labels |
| `bg-white/50` | `rgba(255,255,255,0.5)` | Semi-transparent cards |
| `bg-error-600` | `#DC2626` | Destructive action buttons |

### Primary Colors (Green Palette)

```tsx
// Full palette from src/index.css
bg-primary-50     // #f7ffe5 - Lightest green
bg-primary-100    // #ebffc8
bg-primary-200    // #ceff7d
bg-primary-300    // #bbfb5b - ⭐ Commonly used bright accent
bg-primary-400    // #a0f229
bg-primary-500    // #80d80a - ⭐ Main primary color
bg-primary-600    // #62ad03
bg-primary-700    // #4a8308
bg-primary-800    // #3d670d
bg-primary-900    // #345710
bg-primary-950    // #193102 - Darkest green

// Usage examples
text-primary-300
text-primary-500
border-primary-300
```

### Secondary Colors (Teal Palette)

```tsx
// Full palette from src/index.css
bg-secondary-50   // #f3faf9
bg-secondary-100  // #d5f2ed
bg-secondary-200  // #abe4db
bg-secondary-300  // #7acec5
bg-secondary-400  // #4eb3aa
bg-secondary-500  // #359791 - ⭐ Main secondary color
bg-secondary-600  // #287975
bg-secondary-700  // #236260
bg-secondary-800  // #204e4d - ⭐ Commonly used dark teal
bg-secondary-900  // #1f4242
bg-secondary-950  // #0d2526

// Usage examples
text-secondary-800
text-secondary-500
border-secondary-800
```

### Information Colors (Blue Palette)

```tsx
// Key shades from src/index.css
bg-information-50   // #eff6ff
bg-information-100  // #dbeafe
bg-information-500  // #3b82f6 - ⭐ Main blue
bg-information-900  // #1e3a8a

// Usage examples
text-information-500
border-information-500
bg-information-100 text-information-900 // Info alerts
```

### Dark Colors (Dark Purple/Black Palette)

```tsx
// Key shades from src/index.css
bg-dark-50     // #272166
bg-dark-100    // #231e5b
bg-dark-500    // #05040d - ⭐ Main dark color (text, headings)
bg-dark-900    // #000000
bg-dark-950    // #000000

// Usage examples
text-dark-500  // ⭐ Primary text color
bg-dark-500
border-dark-500
```

### Gray Scale (Neutral Gray)

```tsx
// Full palette from src/index.css
bg-gray-50     // #f7f7f7 - Very light gray
bg-gray-100    // #ededed
bg-gray-200    // #dfdfdf - ⭐ Light borders
bg-gray-300    // #c8c8c8
bg-gray-400    // #adadad
bg-gray-500    // #a1a1a1 - ⭐ Medium gray
bg-gray-600    // #888888 - ⭐ Common gray text
bg-gray-700    // #7b7b7b
bg-gray-800    // #676767
bg-gray-900    // #545454
bg-gray-950    // #363636 - Darkest gray

// Usage examples
text-gray-600
text-gray-500
border-gray-200
bg-gray-100 // Light backgrounds
```

### Light Colors (Grey-Green Palette)

```tsx
// Key shades from src/index.css
bg-light-50    // #f2f3f0
bg-light-100   // #ebece8
bg-light-500   // #90947b - ⭐ Main light color
bg-light-950   // #282822

// Usage examples
bg-light-500
text-light-500
```

### Success Colors (Green Palette)

```tsx
// Key shades from src/index.css
bg-success-50    // #f0fdf4
bg-success-100   // #dcfce7
bg-success-500   // #22c55e - ⭐ Main success green
bg-success-700   // #15803d

// Usage examples
bg-success-100 text-success-700 // Success alerts
text-success-500
border-success-500
```

### Warning Colors (Yellow Palette)

```tsx
// Key shades from src/index.css
bg-warning-50    // #fefce8
bg-warning-100   // #fef9c3
bg-warning-500   // #eab308 - ⭐ Main warning yellow
bg-warning-900   // #713f12

// Usage examples
bg-warning-100 text-warning-900 // Warning alerts
text-warning-500
border-warning-500
```

### Error Colors (Red Palette)

```tsx
// Key shades from src/index.css
bg-error-50     // #fef2f2
bg-error-100    // #fee2e2
bg-error-500    // #ef4444 - ⭐ Main error red
bg-error-600    // #dc2626 - ⭐ Commonly used for destructive buttons
bg-error-700    // #b91c1c
bg-error-900    // #7f1d1d

// Usage examples
bg-error-600     // ⭐ Destructive action buttons
text-error-500
border-error-500
bg-error-50 text-error-700 // Error alerts
```

### Special Colors

```tsx
// White, Black, and Transparency
bg-white            // #FFFFFF
text-white          // White text
bg-white/50         // 50% transparent white
bg-white/10         // 10% transparent white
bg-black            // #000000
text-black          // Black text
border-white        // White border
border-white/10     // 10% transparent white border
```

### Old to New Color Mappings

When refactoring legacy code that imports `colors` object:

| Old Code | New Tailwind Class | Actual Hex Code |
|----------|-------------------|----------------|
| `colors.neutral.dark[500]` | `text-dark-500` or `bg-dark-500` | `#05040D` |
| `colors.primary[300]` | `bg-primary-300` | `#BBFB5B` |
| `colors.primary[500]` | `bg-primary-500` | `#80D80A` |
| `colors.secondary[500]` | `bg-secondary-500` | `#359791` |
| `colors.secondary[800]` | `bg-secondary-800` | `#204E4D` |
| `colors.gray[200]` | `bg-gray-200` or `border-gray-200` | `#DFDFDF` |
| `colors.gray[300]` | `bg-gray-300` | `#C8C8C8` |
| `colors.gray[500]` | `text-gray-500` | `#A1A1A1` |
| `colors.gray[600]` | `text-gray-600` | `#888888` |
| `#FFFFFF80` | `bg-white/50` | 50% transparent white |
| `#EF4444` | `bg-error-500` or `text-error-500` | `#EF4444` |
| `#DC2626` | `bg-error-600` | `#DC2626` |

---

## Typography

### Font Sizes

| Old (px) | Tailwind Class | Pixels | Use Case |
|----------|---------------|--------|----------|
| `fontSize: '11px'` | `text-[11px]` | 11px | Very small labels |
| `fontSize: '12px'` | `text-xs` | 12px | Small text, captions |
| `fontSize: '14px'` | `text-sm` | 14px | Body text, buttons |
| `fontSize: '16px'` | `text-base` | 16px | Standard body text |
| `fontSize: '20px'` | `text-xl` | 20px | Section headers |
| `fontSize: '24px'` | `text-2xl` | 24px | Page titles |
| `fontSize: '30px'` | `text-[30px]` | 30px | Large headings |

### Font Weights

| Old Code | Tailwind Class | Weight | Use Case |
|----------|---------------|--------|----------|
| `fontWeight: 300` | `font-light` | 300 | Light text, subtitles |
| `fontWeight: 400` | `font-normal` | 400 | Normal body text |
| `fontWeight: 500` | `font-medium` | 500 | Emphasis, labels |
| `fontWeight: 600` | `font-semibold` | 600 | Strong emphasis |

### Line Height & Letter Spacing

```tsx
// Line height
leading-tight       // 120%
leading-[150%]      // 150%
leading-[155%]      // 155%

// Letter spacing
tracking-[-0.28px]  // -0.28px
tracking-[-0.32px]  // -0.32px
tracking-[-0.48px]  // -0.48px
```

### Typography Examples

```tsx
// Page Title
<h1 className="text-2xl font-light text-dark-500">Import Clients</h1>

// Section Header
<h2 className="text-xl font-light text-dark-500 mb-6">Last Import Summary</h2>

// Label
<label className="text-sm font-medium text-dark-500">Username:</label>

// Small Caption
<span className="text-xs text-gray-600">Uploaded by: John Doe</span>

// Body Text
<p className="text-base font-light text-dark-500">Description text here</p>
```

---

## Spacing & Sizing

### Padding & Margin

| Old Code | Tailwind Class | Pixels |
|----------|---------------|--------|
| `padding: '4px'` | `p-1` | 4px |
| `padding: '8px'` | `p-2` | 8px |
| `padding: '12px'` | `p-3` | 12px |
| `padding: '16px'` | `p-4` | 16px |
| `padding: '20px'` | `p-5` | 20px |
| `padding: '24px'` | `p-6` | 24px |
| `padding: '10px 16px'` | `px-4 py-2.5` | - |
| `margin: '24px'` | `m-6` | 24px |
| `marginBottom: '4px'` | `mb-1` | 4px |

### Gap (Flexbox/Grid)

| Old Code | Tailwind Class | Pixels |
|----------|---------------|--------|
| `gap: '8px'` | `gap-2` | 8px |
| `gap: '10px'` | `gap-2.5` | 10px |
| `gap: '12px'` | `gap-3` | 12px |
| `gap: '16px'` | `gap-4` | 16px |
| `gap: '24px'` | `gap-6` | 24px |

### Height & Width

```tsx
// Fixed heights
h-8    // 32px
h-9    // 36px
h-10   // 40px
h-12   // 48px
h-[45px]  // Custom 45px

// Fixed widths
w-40   // 160px
w-[24%]  // Custom 24%

// Flexible sizing
flex-1     // flex: 1 0 0
w-full     // width: 100%
h-full     // height: 100%
```

### Border Radius

| Old Code | Tailwind Class | Pixels |
|----------|---------------|--------|
| `borderRadius: '8px'` | `rounded-lg` | 8px |
| `borderRadius: '10px'` | `rounded-[10px]` | 10px |
| `borderRadius: '12px'` | `rounded-xl` | 12px |
| `borderRadius: '9999px'` | `rounded-full` | 9999px (pill) |
| `borderRadius: '50%'` | `rounded-full` | Circle |

---

## Component Patterns

### Button Patterns

#### Primary Action Button
```tsx
<button className="bg-secondary-800 text-white h-12 rounded-full px-6 py-3 text-sm font-medium hover:opacity-90">
  Submit
</button>
```

#### Secondary Action Button
```tsx
<button className="bg-primary-300 text-dark-500 h-12 rounded-full px-6 py-3 text-sm font-medium hover:opacity-90">
  Cancel
</button>
```

#### Button with Icon (Nested Circle Pattern)
```tsx
<button className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg">
  <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
    <Icons.Add size={20} className="text-dark-500" />
  </div>
  <span className="px-4 py-3 text-sm font-medium text-white">Add New User</span>
</button>
```

### Card Patterns

#### Standard Card
```tsx
<div className="rounded-xl bg-white p-6 shadow-sm">
  <h2 className="mb-6 text-xl font-light text-dark-500">Card Title</h2>
  {/* Card content */}
</div>
```

#### Semi-Transparent Card
```tsx
<div className="rounded-xl bg-white/50 p-6 shadow-sm">
  {/* Card content */}
</div>
```

### Modal Patterns

```tsx
<Modal open={isOpen} onClose={handleClose}>
  <ModalHeader
    icon={<Icons.CloudDownload size={24} className="text-dark-500" />}
    title="Modal Title"
  />
  <ModalContent>
    {/* Modal body */}
  </ModalContent>
  <ModalFooter>
    <Button variant="outline" onClick={handleClose}>
      Cancel
    </Button>
    <Button variant="primary" onClick={handleSubmit}>
      Save
    </Button>
  </ModalFooter>
</Modal>
```

### Status Badge Patterns

```tsx
// Success Badge
<span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-secondary-800 text-white">
  <span className="h-2 w-2 rounded-full bg-white" />
  Completed
</span>

// Error Badge
<span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-error-600 text-white">
  <Icons.Warning size={14} className="text-white" />
  Failed
</span>
```

### Form Input Patterns

```tsx
// Label + Input
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium text-dark-500">
    Username:
  </label>
  <input
    type="text"
    className="h-12 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-dark-500 outline-none focus:border-primary-500"
    placeholder="Enter username"
  />
</div>
```

---

## Icon Usage

### Icon Component Pattern

**Always use className for icon colors, never the color prop.**

❌ **Don't do this:**
```tsx
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

<Icons.Search size={20} color={colors.neutral.dark[500]} />
```

✅ **Do this:**
```tsx
import { Icons } from '@/lib/icons'

<Icons.Search size={20} className="text-dark-500" />
```

### Common Icon Patterns

```tsx
// Button icon
<Icons.Add size={20} className="text-dark-500" />

// Status icon
<Icons.Warning size={24} className="text-error-500" />

// Action icon
<Icons.View size={16} className="text-dark-500" strokeWidth={1.5} />

// Decorative icon
<Icons.CloudDownload size={48} className="text-dark-500" strokeWidth={0.5} />
```

---

## Common Conversions

### Flexbox Conversions

| Old Inline Style | Tailwind Classes |
|-----------------|------------------|
| `display: 'flex'` | `flex` |
| `flexDirection: 'row'` | `flex-row` |
| `flexDirection: 'column'` | `flex-col` |
| `alignItems: 'center'` | `items-center` |
| `alignItems: 'start'` | `items-start` |
| `justifyContent: 'center'` | `justify-center` |
| `justifyContent: 'between'` | `justify-between` |
| `flex: '1 0 0'` | `flex-1` |
| `gap: '10px'` | `gap-2.5` |

### Position & Layout

| Old Inline Style | Tailwind Classes |
|-----------------|------------------|
| `position: 'relative'` | `relative` |
| `position: 'absolute'` | `absolute` |
| `position: 'fixed'` | `fixed` |
| `zIndex: 10` | `z-10` |
| `overflow: 'hidden'` | `overflow-hidden` |
| `whiteSpace: 'nowrap'` | `whitespace-nowrap` |

### Text & Typography

| Old Inline Style | Tailwind Classes |
|-----------------|------------------|
| `textAlign: 'center'` | `text-center` |
| `textAlign: 'left'` | `text-left` |
| `textAlign: 'right'` | `text-right` |
| `textTransform: 'capitalize'` | `capitalize` |
| `textTransform: 'uppercase'` | `uppercase` |
| `textDecoration: 'none'` | `no-underline` |

### Effects & Transforms

| Old Inline Style | Tailwind Classes |
|-----------------|------------------|
| `opacity: 0.5` | `opacity-50` |
| `cursor: 'pointer'` | `cursor-pointer` |
| `cursor: 'not-allowed'` | `cursor-not-allowed` |
| `boxShadow: '...'` | `shadow-sm`, `shadow-md`, `shadow-lg` |
| `transition: 'all'` | `transition-all` |

---

## Code Quality

### Pre-Commit Checks

The project uses Husky pre-commit hooks to enforce code quality:

1. **TypeScript compilation** - `tsc -b`
2. **Prettier formatting** - `prettier --check`
3. **ESLint linting** - `eslint . --max-warnings=0`
4. **Vitest tests** - `vitest run`

### Running Quality Checks Manually

```bash
# Type checking
npm run typecheck

# Format code
npm run format

# Check formatting
npm run format:check

# Lint code
npm run lint

# Run tests
npm run test

# Build project
npm run build
```

### Code Review Checklist

Before submitting a PR, ensure:

- [ ] No inline `style={{}}` attributes
- [ ] No `import { colors } from '@/lib/colors'`
- [ ] Icons use `className` instead of `color` prop
- [ ] All Tailwind classes are properly applied
- [ ] Code is formatted with Prettier
- [ ] TypeScript has no errors
- [ ] All tests pass
- [ ] Build succeeds

---

## Examples

### Complete Component Example

Here's a complete example showing best practices:

```tsx
/**
 * UserCard Component
 *
 * Displays user information with action buttons
 */

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface UserCardProps {
  name: string
  email: string
  status: 'active' | 'inactive'
  onEdit: () => void
  onDelete: () => void
  className?: string
}

export function UserCard({
  name,
  email,
  status,
  onEdit,
  onDelete,
  className
}: UserCardProps) {
  const isActive = status === 'active'

  return (
    <div className={cn(
      'rounded-xl bg-white p-6 shadow-sm',
      className
    )}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-medium text-dark-500">{name}</h3>

        {/* Status Badge */}
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
          isActive
            ? 'bg-success-500 text-white'
            : 'bg-gray-200 text-gray-600'
        )}>
          <span className={cn(
            'h-2 w-2 rounded-full',
            isActive ? 'bg-white' : 'bg-gray-600'
          )} />
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Email */}
      <p className="mb-6 text-sm text-gray-600">{email}</p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onEdit}
          className="flex items-center gap-2 rounded-lg bg-primary-300 px-4 py-2 text-sm font-medium text-dark-500 transition-colors hover:opacity-90"
        >
          <Icons.PencilEdit size={16} className="text-dark-500" />
          Edit
        </button>

        <button
          onClick={onDelete}
          className="flex items-center gap-2 rounded-lg border border-error-500 bg-white px-4 py-2 text-sm font-medium text-error-500 transition-colors hover:bg-error-50"
        >
          <Icons.Trash size={16} className="text-error-500" />
          Delete
        </button>
      </div>
    </div>
  )
}
```

---

## References

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs/v4-alpha)
- **Project Tailwind Config**: `src/index.css` (@theme directive) - **Source of Truth**
- Utility Functions: `src/lib/utils.ts`
- Icon Library: `src/lib/icons.ts`

---

## Questions or Updates?

If you have questions about these patterns or need to propose changes:

1. Check existing components for examples
2. Consult `src/index.css` for the definitive color configuration
3. Consult with the team lead
4. Update this document with any approved changes

**Last Updated**: December 2024
**Reflects**: Tailwind v4 configuration in `src/index.css`
