import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../Input'

describe('Input', () => {
  it('renders with default props', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<Input label="Username" placeholder="Enter username" />)
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })

  it('renders with error message', () => {
    render(<Input error="This field is required" placeholder="Enter text" />)
    expect(screen.getByRole('alert')).toHaveTextContent('This field is required')
    expect(screen.getByPlaceholderText('Enter text')).toHaveClass('border-error-500')
  })

  it('renders with helper text', () => {
    render(<Input helperText="Enter your email address" placeholder="Email" />)
    expect(screen.getByText('Enter your email address')).toBeInTheDocument()
  })

  it('does not show helper text when error is present', () => {
    render(
      <Input error="Invalid email" helperText="Enter your email address" placeholder="Email" />
    )
    expect(screen.queryByText('Enter your email address')).not.toBeInTheDocument()
    expect(screen.getByText('Invalid email')).toBeInTheDocument()
  })

  it('handles input changes', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Input placeholder="Type here" onChange={handleChange} />)

    await user.type(screen.getByPlaceholderText('Type here'), 'Hello')
    expect(handleChange).toHaveBeenCalled()
  })

  it('renders with different sizes', () => {
    const { rerender } = render(<Input inputSize="sm" placeholder="Small" />)
    expect(screen.getByPlaceholderText('Small')).toHaveClass('h-8')

    rerender(<Input inputSize="md" placeholder="Medium" />)
    expect(screen.getByPlaceholderText('Medium')).toHaveClass('h-[45px]')

    rerender(<Input inputSize="lg" placeholder="Large" />)
    expect(screen.getByPlaceholderText('Large')).toHaveClass('h-12')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Input disabled placeholder="Disabled" />)
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled()
  })

  it('renders with left icon', () => {
    render(<Input leftIcon={<span data-testid="left-icon">L</span>} placeholder="Search" />)
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('renders with right icon', () => {
    render(<Input rightIcon={<span data-testid="right-icon">R</span>} placeholder="Search" />)
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('has correct aria-invalid attribute when error is present', () => {
    render(<Input error="Error message" placeholder="Input" />)
    expect(screen.getByPlaceholderText('Input')).toHaveAttribute('aria-invalid', 'true')
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" placeholder="Custom" />)
    expect(screen.getByPlaceholderText('Custom')).toHaveClass('custom-class')
  })

  it('renders different input types', () => {
    const { rerender } = render(<Input type="email" placeholder="Email" />)
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('type', 'email')

    rerender(<Input type="password" placeholder="Password" />)
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password')
  })

  // STYLING STANDARDIZATION TESTS (Phase 2)

  it('input should NOT have inline style attribute (Tailwind classes only)', () => {
    render(<Input placeholder="Test input" />)
    const input = screen.getByPlaceholderText('Test input')
    expect(input).not.toHaveAttribute('style')
  })

  it('label should NOT have inline style attribute (Tailwind classes only)', () => {
    render(<Input label="Test label" placeholder="Test input" />)
    const label = screen.getByText('Test label')
    expect(label).not.toHaveAttribute('style')
  })

  it('label should use Tailwind font-light class instead of inline font-weight', () => {
    render(<Input label="Test label" placeholder="Test input" />)
    const label = screen.getByText('Test label')
    expect(label).toHaveClass('font-light')
  })

  it('input should use text-dark-950 class for text color', () => {
    render(<Input placeholder="Test input" />)
    const input = screen.getByPlaceholderText('Test input')
    expect(input).toHaveClass('text-dark-950')
  })
})
