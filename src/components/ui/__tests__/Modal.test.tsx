import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../Modal'

describe('Modal', () => {
  it('renders when open is true', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <div>Modal content</div>
      </Modal>
    )
    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <div>Modal content</div>
      </Modal>
    )
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })

  it('renders close button', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <div>Content</div>
      </Modal>
    )
    expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    render(
      <Modal open={true} onClose={handleClose}>
        <div>Content</div>
      </Modal>
    )

    await user.click(screen.getByRole('button', { name: /close modal/i }))
    expect(handleClose).toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(
      <Modal open={true} onClose={vi.fn()} className="custom-modal">
        <div>Content</div>
      </Modal>
    )
    const content = screen.getByText('Content').parentElement
    expect(content).toHaveClass('custom-modal')
  })

  // STYLING STANDARDIZATION TESTS (Phase 2)

  it('Modal overlay should NOT have custom inline styles (backgroundColor, backdropFilter)', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <div>Content</div>
      </Modal>
    )
    // Overlay is the backdrop element - query from document since it's portaled
    const overlay = document.querySelector('[class*="backdrop-blur"]')
    // Radix UI adds pointer-events: auto; which is expected
    // We're checking that OUR custom styles (backgroundColor, backdropFilter) are not present
    const style = overlay?.getAttribute('style') || ''
    expect(style).not.toContain('backgroundColor')
    expect(style).not.toContain('backdropFilter')
    expect(style).not.toContain('background-color')
    expect(style).not.toContain('backdrop-filter')
  })

  it('Modal content should NOT have custom inline styles (backgroundColor, padding, boxShadow)', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <div>Modal content</div>
      </Modal>
    )
    // Query the DialogContent element directly
    const content = document.querySelector('[class*="bg-light-50"]')
    // Radix UI adds pointer-events: auto; which is expected
    // We're checking that OUR custom styles are not present
    const style = content?.getAttribute('style') || ''
    expect(style).not.toContain('backgroundColor')
    expect(style).not.toContain('background-color')
    expect(style).not.toContain('padding')
    expect(style).not.toContain('boxShadow')
    expect(style).not.toContain('box-shadow')
    expect(style).not.toContain('maxHeight')
    expect(style).not.toContain('max-height')
  })

  it('Modal content should use Tailwind classes for styling', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <div>Modal content</div>
      </Modal>
    )
    // Query the DialogContent element directly
    const content = document.querySelector('[class*="bg-light-50"]')
    // Should have Tailwind classes for background, padding, shadows
    expect(content).toHaveClass('bg-light-50')
    expect(content).toHaveClass('p-10')
  })
})

describe('ModalHeader', () => {
  it('renders title', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalHeader title="Test Title" />
      </Modal>
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalHeader title="Title" icon={<span data-testid="modal-icon">Icon</span>} />
      </Modal>
    )
    expect(screen.getByTestId('modal-icon')).toBeInTheDocument()
  })

  // STYLING STANDARDIZATION TESTS (Phase 2)

  it('ModalHeader should NOT have inline style attribute', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalHeader title="Title" />
      </Modal>
    )
    // Query from document since Modal is portaled
    const header = document.querySelector('.border-b')
    expect(header).not.toHaveAttribute('style')
  })

  it('ModalHeader title should NOT have inline style attribute', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalHeader title="Title" />
      </Modal>
    )
    const title = screen.getByText('Title')
    expect(title).not.toHaveAttribute('style')
  })

  it('ModalHeader title should use Tailwind text size classes', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalHeader title="Title" />
      </Modal>
    )
    const title = screen.getByText('Title')
    expect(title).toHaveClass('text-2xl')
    expect(title).toHaveClass('text-dark-500')
  })
})

describe('ModalContent', () => {
  it('renders children', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalContent>
          <div>Content text</div>
        </ModalContent>
      </Modal>
    )
    expect(screen.getByText('Content text')).toBeInTheDocument()
  })

  // STYLING STANDARDIZATION TESTS (Phase 2)

  it('ModalContent should NOT have inline style attribute', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalContent>
          <div>Content</div>
        </ModalContent>
      </Modal>
    )
    // Query from document since Modal is portaled
    const content = document.querySelector('.modal-content-scroll')
    expect(content).not.toHaveAttribute('style')
  })

  it('ModalContent should use Tailwind classes for max-height and padding', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalContent>
          <div>Content</div>
        </ModalContent>
      </Modal>
    )
    // Query from document since Modal is portaled
    const content = document.querySelector('.modal-content-scroll')
    expect(content).toHaveClass('max-h-[calc(90vh-200px)]')
    expect(content).toHaveClass('px-1')
    expect(content).toHaveClass('py-6')
  })
})

describe('ModalFooter', () => {
  it('renders children', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalFooter>
          <button>Cancel</button>
          <button>Confirm</button>
        </ModalFooter>
      </Modal>
    )
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  // STYLING STANDARDIZATION TESTS (Phase 2)

  it('ModalFooter should NOT have inline style attribute', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalFooter>
          <button>Action</button>
        </ModalFooter>
      </Modal>
    )
    // Query from document since Modal is portaled
    const footer = document.querySelector('.border-t')
    expect(footer).not.toHaveAttribute('style')
  })

  it('ModalFooter should use Tailwind classes for border and padding', () => {
    render(
      <Modal open={true} onClose={vi.fn()}>
        <ModalFooter>
          <button>Action</button>
        </ModalFooter>
      </Modal>
    )
    // Query from document since Modal is portaled
    const footer = document.querySelector('.border-t')
    expect(footer).toHaveClass('border-light-200')
    expect(footer).toHaveClass('pt-3')
  })
})
