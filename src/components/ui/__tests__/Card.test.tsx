import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../Card'

describe('Card', () => {
  it('renders with default props', () => {
    render(<Card data-testid="card">Card content</Card>)
    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders with default variant (shadow-lg)', () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).toHaveClass('shadow-lg')
  })

  it('renders with elevated variant', () => {
    render(
      <Card variant="elevated" data-testid="card">
        Content
      </Card>
    )
    expect(screen.getByTestId('card')).toHaveClass('shadow-2xl')
  })

  it('renders with outline variant', () => {
    render(
      <Card variant="outline" data-testid="card">
        Content
      </Card>
    )
    expect(screen.getByTestId('card')).toHaveClass('border')
  })

  it('renders with different padding sizes', () => {
    const { rerender } = render(
      <Card padding="sm" data-testid="card">
        Content
      </Card>
    )
    expect(screen.getByTestId('card')).toHaveClass('p-4')

    rerender(
      <Card padding="md" data-testid="card">
        Content
      </Card>
    )
    expect(screen.getByTestId('card')).toHaveClass('p-6')

    rerender(
      <Card padding="lg" data-testid="card">
        Content
      </Card>
    )
    expect(screen.getByTestId('card')).toHaveClass('p-8')

    rerender(
      <Card padding="none" data-testid="card">
        Content
      </Card>
    )
    expect(screen.getByTestId('card')).toHaveClass('p-0')
  })

  it('applies custom className', () => {
    render(
      <Card className="custom-class" data-testid="card">
        Content
      </Card>
    )
    expect(screen.getByTestId('card')).toHaveClass('custom-class')
  })
})

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header content</CardHeader>)
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <CardHeader className="custom-class" data-testid="header">
        Header
      </CardHeader>
    )
    expect(screen.getByTestId('header')).toHaveClass('custom-class')
  })
})

describe('CardTitle', () => {
  it('renders as h3', () => {
    render(<CardTitle>Title</CardTitle>)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title')
  })

  it('applies custom className', () => {
    render(<CardTitle className="custom-class">Title</CardTitle>)
    expect(screen.getByRole('heading')).toHaveClass('custom-class')
  })
})

describe('CardDescription', () => {
  it('renders description text', () => {
    render(<CardDescription>Description text</CardDescription>)
    expect(screen.getByText('Description text')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <CardDescription className="custom-class" data-testid="desc">
        Description
      </CardDescription>
    )
    expect(screen.getByTestId('desc')).toHaveClass('custom-class')
  })
})

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Content</CardContent>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter>Footer content</CardFooter>)
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })
})

describe('Card composition', () => {
  it('renders complete card with all subcomponents', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description</CardDescription>
        </CardHeader>
        <CardContent>Main content goes here</CardContent>
        <CardFooter>Footer content</CardFooter>
      </Card>
    )

    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Card Title' })).toBeInTheDocument()
    expect(screen.getByText('Card description')).toBeInTheDocument()
    expect(screen.getByText('Main content goes here')).toBeInTheDocument()
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })
})

// STYLING STANDARDIZATION TESTS (Phase 2)

describe('Card styling standardization', () => {
  it('Card should NOT have inline style attribute', () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId('card')).not.toHaveAttribute('style')
  })

  it('CardTitle should use standard Tailwind text size (not custom text-xs-display)', () => {
    render(<CardTitle>Title</CardTitle>)
    const title = screen.getByRole('heading')
    // Should use standard Tailwind text size instead of custom text-xs-display
    expect(title).toHaveClass('text-xl')
  })

  it('CardDescription should use standard Tailwind text size (not custom text-text-sm)', () => {
    render(<CardDescription data-testid="desc">Description</CardDescription>)
    const desc = screen.getByTestId('desc')
    // Should use standard Tailwind text-sm instead of custom text-text-sm
    expect(desc).toHaveClass('text-sm')
  })
})
