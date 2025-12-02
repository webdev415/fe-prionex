import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Alert, AlertTitle, AlertDescription, AlertIcons } from '../Alert'

describe('Alert', () => {
  it('renders with default props', () => {
    render(<Alert>Alert message</Alert>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Alert message')).toBeInTheDocument()
  })

  it('renders with default variant styling', () => {
    render(<Alert>Default alert</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('bg-dark-300')
  })

  it('renders with success variant', () => {
    render(<Alert variant="success">Success message</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('bg-success-950')
    expect(screen.getByRole('alert')).toHaveClass('border-success-500')
  })

  it('renders with warning variant', () => {
    render(<Alert variant="warning">Warning message</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('bg-warning-950')
    expect(screen.getByRole('alert')).toHaveClass('border-warning-500')
  })

  it('renders with error variant', () => {
    render(<Alert variant="error">Error message</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('bg-error-950')
    expect(screen.getByRole('alert')).toHaveClass('border-error-500')
  })

  it('renders with info variant', () => {
    render(<Alert variant="info">Info message</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('bg-info-950')
    expect(screen.getByRole('alert')).toHaveClass('border-info-500')
  })

  it('renders with custom icon', () => {
    render(<Alert icon={<span data-testid="custom-icon">!</span>}>Alert with icon</Alert>)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Alert className="custom-class">Alert</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('custom-class')
  })
})

describe('AlertTitle', () => {
  it('renders title text', () => {
    render(<AlertTitle>Alert Title</AlertTitle>)
    expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent('Alert Title')
  })

  it('applies custom className', () => {
    render(<AlertTitle className="custom-class">Title</AlertTitle>)
    expect(screen.getByRole('heading')).toHaveClass('custom-class')
  })
})

describe('AlertDescription', () => {
  it('renders description text', () => {
    render(<AlertDescription>Description text</AlertDescription>)
    expect(screen.getByText('Description text')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <AlertDescription className="custom-class" data-testid="desc">
        Description
      </AlertDescription>
    )
    expect(screen.getByTestId('desc')).toHaveClass('custom-class')
  })
})

describe('AlertIcons', () => {
  it('success icon is defined', () => {
    expect(AlertIcons.success).toBeDefined()
  })

  it('warning icon is defined', () => {
    expect(AlertIcons.warning).toBeDefined()
  })

  it('error icon is defined', () => {
    expect(AlertIcons.error).toBeDefined()
  })

  it('info icon is defined', () => {
    expect(AlertIcons.info).toBeDefined()
  })
})

describe('Alert composition', () => {
  it('renders complete alert with title and description', () => {
    render(
      <Alert variant="error" icon={AlertIcons.error}>
        <AlertTitle>Error Title</AlertTitle>
        <AlertDescription>This is an error description.</AlertDescription>
      </Alert>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Error Title' })).toBeInTheDocument()
    expect(screen.getByText('This is an error description.')).toBeInTheDocument()
  })

  it('renders success alert with icon', () => {
    render(
      <Alert variant="success" icon={AlertIcons.success}>
        <AlertTitle>Success!</AlertTitle>
        <AlertDescription>Operation completed successfully.</AlertDescription>
      </Alert>
    )

    expect(screen.getByRole('alert')).toHaveClass('bg-success-950')
    expect(screen.getByRole('heading', { name: 'Success!' })).toBeInTheDocument()
  })
})
