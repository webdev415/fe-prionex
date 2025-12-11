# CRM Prionex Design System

**Version**: 1.0.0
**Last Updated**: 2025-12-11
**Status**: Active

---

## Overview

This document defines the official design system for the CRM Prionex frontend application. All components must adhere to these guidelines to ensure visual consistency and maintainability.

---

## 🎨 Color Palette

### Active Colors (In Use)

#### PRIMARY (Light Blue #0CA8EB)
**Usage**: CTAs, links, focus states, interactive elements

```tsx
// Tailwind classes
<button className="bg-primary-500 hover:bg-primary-600 text-white">
  Primary Button
</button>
```

**Available Shades**:
- `primary-50` to `primary-950` (11 shades)
- **Main shade**: `primary-500` (#0CA8EB)

**WCAG AA Contrast**:
- `primary-500` on white: 4.9:1 ✅
- `primary-950` on white: 13.2:1 ✅

---

#### INFORMATION (Blue #3B82F6)
**Usage**: Info messages, secondary actions, informational badges

```tsx
<Alert className="bg-information-50 border-information-500 text-information-900">
  Informational message
</Alert>
```

**Available Shades**:
- `information-50` to `information-950` (11 shades)
- **Main shade**: `information-500` (#3B82F6)

---

#### DARK (Dark Gray/Black)
**Usage**: Text, dark backgrounds, headers, navigation

```tsx
<Sidebar className="bg-dark-900 text-dark-50" />
```

**Available Shades**:
- `dark-50` to `dark-950` (11 shades)
- **Main shade**: `dark-500` (#050D11)

---

#### GRAY (Neutral Gray)
**Usage**: Borders, dividers, disabled states, secondary text

```tsx
<Input className="border-gray-300 focus:border-primary-500 disabled:bg-gray-100" />
```

**Available Shades**:
- `gray-50` to `gray-950` (11 shades)
- **Main shade**: `gray-500` (#A1A1A1)

---

#### LIGHT (Light Gray/White)
**Usage**: Light backgrounds, cards, panels, elevated surfaces

```tsx
<Card className="bg-light-50 border-light-200" />
```

**Available Shades**:
- `light-50` to `light-950` (11 shades)
- **Main shade**: `light-500` (#6D727D)

---

#### SUCCESS (Green #22C55E)
**Usage**: Success messages, positive feedback, completed states

```tsx
<Badge className="bg-success-100 text-success-700 border-success-500">
  Success
</Badge>
```

**Available Shades**:
- `success-50` to `success-950` (11 shades)
- **Main shade**: `success-500` (#22C55E)

---

#### WARNING (Yellow #EAB308)
**Usage**: Warning messages, caution states, pending actions

```tsx
<Alert className="bg-warning-100 text-warning-900 border-warning-500">
  Warning message
</Alert>
```

**Available Shades**:
- `warning-50` to `warning-950` (11 shades)
- **Main shade**: `warning-500` (#EAB308)

---

#### ERROR (Red #EF4444)
**Usage**: Error messages, destructive actions, validation failures

```tsx
<Button variant="destructive" className="bg-error-500 hover:bg-error-600 text-white">
  Delete
</Button>

<Input className="border-error-500 focus:ring-error-500" aria-invalid />
```

**Available Shades**:
- `error-50` to `error-950` (11 shades)
- **Main shade**: `error-500` (#EF4444)

---

### Reserved Colors (Not Currently In Use)

#### SECONDARY (Green #10B981)
**Status**: ❌ NOT IN USE
**Note**: Defined in system but reserved for future use

```tsx
// Available but not currently used in components
className="bg-secondary-500"
```

---

#### TERTIARY (Purple #8B5CF6)
**Status**: ❌ NOT IN USE
**Note**: Defined in system but reserved for future use

```tsx
// Available but not currently used in components
className="bg-tertiary-500"
```

---

### Utility Colors

```tsx
// Black and White
className="bg-black text-white"
className="bg-white text-black"
```

---

## 📝 Typography

### Display Sizes (Headings & Hero Sections)

| Class | Font Size | Line Height | Weights | Usage |
|-------|-----------|-------------|---------|-------|
| `text-2xl-display` | 72px | 125% (90px) | 400, 500, 700 | Hero headings |
| `text-xl-display` | 60px | 125% (75px) | 400, 500, 700 | Page titles |
| `text-lg-display` | 48px | 126% (60.48px) | 400, 500, 700 | Section headers |
| `text-md-display` | 36px | 129% (46.44px) | 400, 500, 700 | Card titles |
| `text-sm-display` | 30px | 120% (36px) | 400, 500, 700 | Subsection headers |
| `text-xs-display` | 24px | 132% (31.68px) | 400, 500, 700 | Small headings |

**Example**:
```tsx
<h1 className="text-2xl-display font-bold text-dark-900">
  Dashboard Overview
</h1>
```

---

### Text Sizes (Body Content)

| Class | Font Size | Line Height | Weights | Usage |
|-------|-----------|-------------|---------|-------|
| `text-text-xl` | 20px | 150% (30px) | 400, 500, 700 | Large body text |
| `text-text-lg` | 18px | 155% (27.9px) | 400, 500, 700 | Standard body text |
| `text-text-md` | 16px | 150% (24px) | 400, 500, 700 | Default body text |
| `text-text-sm` | 14px | 140% (19.6px) | 400, 500, 700 | Small text, labels |
| `text-text-xs` | 12px | 150% (18px) | 400, 500, 700 | Captions, metadata |

**Example**:
```tsx
<p className="text-text-lg font-regular text-gray-700">
  Standard paragraph text with good readability.
</p>
```

---

### Font Weights

| Class | Weight | Usage |
|-------|--------|-------|
| `font-regular` | 400 | Body text, paragraphs |
| `font-medium` | 500 | Emphasis, button labels |
| `font-bold` | 700 | Headings, strong emphasis |

**Font Family**: Lexend (loaded from Google Fonts)

---

## 🧩 Component Patterns

### Button Variants (CVA Pattern)

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200',
  {
    variants: {
      variant: {
        primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        secondary: 'bg-gray-200 text-dark-900 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500',
        destructive: 'bg-error-500 text-white hover:bg-error-600 focus:ring-2 focus:ring-error-500',
        ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
        link: 'bg-transparent underline-offset-4 hover:underline text-primary-500',
      },
      size: {
        sm: 'h-8 px-3 text-text-sm',
        md: 'h-10 px-4 text-text-md',
        lg: 'h-12 px-6 text-text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

---

### Input Fields

```tsx
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-text-md',
          'placeholder:text-gray-400',
          'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
```

---

### Card Components

```tsx
<Card className="bg-dark-400 rounded-2xl shadow-card p-6">
  <CardHeader>
    <CardTitle className="text-lg-display font-bold text-white">
      Card Title
    </CardTitle>
  </CardHeader>
  <CardContent className="text-text-md text-gray-300">
    Card content goes here
  </CardContent>
</Card>
```

---

## ⚡ Utility Patterns

### Tailwind Merge (cn utility)

Always use the `cn()` utility function to merge Tailwind classes safely:

```tsx
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
<div className={cn('bg-primary-500', 'hover:bg-primary-600', className)} />
```

**Benefits**:
- Resolves conflicting Tailwind classes (e.g., `px-4` overrides `p-2`)
- Handles conditional classes via `clsx`
- Type-safe class composition

---

## 🎯 Best Practices

### DO ✅

```tsx
// Use Tailwind utility classes
<div className="bg-primary-500 text-white p-4 rounded-lg" />

// Use CVA for component variants
const buttonVariants = cva(base, { variants })

// Use cn() to merge classes
className={cn(buttonVariants({ variant }), className)}

// Use semantic color names
<Alert className="bg-error-50 border-error-500" />

// Follow typography scale
<h1 className="text-2xl-display font-bold" />
```

### DON'T ❌

```tsx
// Don't use inline styles
<div style={{ backgroundColor: '#0CA8EB', padding: '16px' }} />

// Don't hardcode colors
<div className="bg-[#0CA8EB]" />

// Don't use arbitrary values for standard spacing
<div className="p-[16px]" /> // Use p-4 instead

// Don't mix style approaches
<div style={{ color: 'red' }} className="bg-primary-500" />

// Don't skip the cn() utility
<button className={`${baseClass} ${variantClass}`} />
```

---

## 📐 Spacing & Sizing

Use Tailwind's standard spacing scale:

| Class | Size | Usage |
|-------|------|-------|
| `p-1` to `p-96` | 0.25rem to 24rem | Padding |
| `m-1` to `m-96` | 0.25rem to 24rem | Margin |
| `gap-1` to `gap-96` | 0.25rem to 24rem | Gap (flex/grid) |

**Common values**:
- `p-2` = 0.5rem (8px)
- `p-4` = 1rem (16px)
- `p-6` = 1.5rem (24px)
- `p-8` = 2rem (32px)

---

## 🔲 Border Radius

| Class | Size | Usage |
|-------|------|-------|
| `rounded-sm` | 4px | Small elements |
| `rounded-md` | 8px | Standard elements |
| `rounded-lg` | 12px | Buttons, inputs, cards |
| `rounded-xl` | 16px | Large cards |
| `rounded-2xl` | 24px | Hero cards, modals |

---

## 💫 Shadows

| Class | Effect | Usage |
|-------|--------|-------|
| `shadow-sm` | Subtle | Subtle lift |
| `shadow-md` | Moderate | Cards, dropdowns |
| `shadow-lg` | Strong | Modals, popovers |
| `shadow-xl` | Very strong | Dialogs |
| `shadow-2xl` | Dramatic | Hero cards |
| `shadow-card` | Custom card shadow | Primary cards |

---

## ♿ Accessibility Guidelines

### Color Contrast (WCAG AA)

Minimum contrast ratio: **4.5:1** for normal text, **3:1** for large text (18px+)

**Approved Combinations**:
- `primary-500` (#0CA8EB) on white: 4.9:1 ✅
- `primary-950` (#07304A) on white: 13.2:1 ✅
- `dark-900` (#000000) on white: 21:1 ✅

### Focus States

Always include visible focus states:

```tsx
// Good
className="focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"

// Bad
className="outline-none" // Never use without replacement
```

### Aria Labels

```tsx
<Button aria-label="Close dialog" />
<Input aria-invalid={hasError} aria-describedby="error-message" />
```

---

## 🚫 Anti-Patterns

### Inline Styles

```tsx
// ❌ WRONG - ESLint will warn
<div style={{ backgroundColor: '#0CA8EB', padding: '16px' }}>
  Content
</div>

// ✅ CORRECT - Use Tailwind
<div className="bg-primary-500 p-4">
  Content
</div>
```

### Magic Numbers

```tsx
// ❌ WRONG
<div className="p-[17px]" />

// ✅ CORRECT - Use standard scale
<div className="p-4" /> // 16px
```

### Color Hardcoding

```tsx
// ❌ WRONG
<div className="bg-[#0CA8EB]" />

// ✅ CORRECT
<div className="bg-primary-500" />
```

---

## 📦 Component Library Structure

```
src/
├── components/
│   ├── ui/                 # Core UI primitives (Button, Input, Card, Modal)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── Modal.tsx
│   ├── layout/             # Layout components (Sidebar, Header)
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── DashboardLayout.tsx
│   └── features/           # Feature-specific components
│       ├── UserProfile.tsx
│       ├── Dashboard.tsx
│       └── Settings.tsx
├── lib/
│   └── utils.ts            # cn() utility and helpers
└── styles/
    └── index.css           # Tailwind imports and custom utilities
```

---

## 🔧 Development Tools

### ESLint Rules

Inline styles trigger ESLint warnings:

```bash
npm run lint
# ⚠ Warning: Avoid inline styles. Use Tailwind CSS classes instead.
```

### Tailwind IntelliSense

Install VS Code extension: `bradlc.vscode-tailwindcss`

Features:
- Autocomplete for Tailwind classes
- Color preview
- Linting for invalid classes

---

## 📚 References

- **Tailwind CSS Documentation**: https://tailwindcss.com/docs
- **CVA Documentation**: https://cva.style/docs
- **Radix UI Primitives**: https://www.radix-ui.com/primitives
- **WCAG Contrast Checker**: https://webaim.org/resources/contrastchecker/

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-11 | Initial design system documentation |

---

**Maintained by**: CRM Prionex Frontend Team
**Contact**: For questions or suggestions, create an issue in the project repository.
