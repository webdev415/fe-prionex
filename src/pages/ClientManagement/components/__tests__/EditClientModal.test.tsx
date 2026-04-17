import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { EditClientModal } from '../EditClientModal'
import * as useClientsModule from '@/features/clients/hooks/useClients'
import { toast } from 'sonner'
import { useHasPermission } from '@/hooks'

vi.mock('@/features/clients/hooks/useClients')
vi.mock('@/hooks', () => ({
  useHasPermission: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'pages.clients.editModal.title': 'Edit Client',
        'pages.clients.editModal.personalInfo': 'Personal Information',
        'pages.clients.editModal.phoneNumbers': 'Phone Numbers',
        'pages.clients.editModal.addresses': 'Addresses',
        'pages.clients.editModal.contacts': 'Contacts & Referrals',
        'pages.clients.editModal.firstName': 'First Name',
        'pages.clients.editModal.lastName': 'Last Name',
        'pages.clients.editModal.middleName': 'Middle Name',
        'pages.clients.editModal.dateOfBirth': 'Date of Birth',
        'pages.clients.editModal.email': 'Email',
        'pages.clients.editModal.phonePrimary': 'Primary Phone',
        'pages.clients.editModal.phoneSecondary': 'Secondary Phone',
        'pages.clients.editModal.addAddress': 'Add Address',
        'pages.clients.editModal.addContact': 'Add Contact',
        'pages.clients.editModal.addressType': 'Address Type',
        'pages.clients.editModal.region': 'Region',
        'pages.clients.editModal.city': 'City',
        'pages.clients.editModal.street': 'Street',
        'pages.clients.editModal.building': 'Building',
        'pages.clients.editModal.apartment': 'Apartment',
        'pages.clients.editModal.postalCode': 'Postal Code',
        'pages.clients.editModal.isPrimary': 'Primary',
        'pages.clients.detail.contactValue': 'Contact',
        'pages.clients.detail.comment': 'Comment',
        'pages.clients.detail.contactType': 'Contact type',
        'pages.clients.detail.workPhone': 'Work phone',
        'pages.clients.editModal.relationship': 'Relationship',
        'pages.clients.editModal.phone': 'Phone',
        'pages.clients.editModal.notes': 'Notes',
        'pages.clients.editModal.save': 'Save Changes',
        'pages.clients.editModal.saving': 'Saving...',
        'pages.clients.editModal.cancel': 'Cancel',
        'actions.close': 'Close',
        'pages.clients.editModal.saveSuccess': 'Client updated successfully',
        'pages.clients.editModal.saveError': 'Failed to update client',
        'pages.clients.editModal.addressCreated': 'Address added successfully',
        'pages.clients.editModal.addressUpdated': 'Address updated successfully',
        'pages.clients.editModal.addressDeleted': 'Address removed successfully',
        'pages.clients.editModal.contactCreated': 'Contact added successfully',
        'pages.clients.editModal.contactUpdated': 'Contact updated successfully',
        'pages.clients.editModal.contactDeleted': 'Contact removed successfully',
        'pages.clients.editModal.confirmDelete': 'Are you sure you want to remove this?',
        'pages.clients.editModal.taxId': 'Tax ID',
        'pages.clients.editModal.editAddress': 'Edit address',
        'pages.clients.editModal.deleteAddress': 'Delete address',
        'pages.clients.editModal.editContact': 'Edit contact',
        'pages.clients.editModal.deleteContact': 'Delete contact',
        'pages.clients.detail.tabs.passport': 'Passport',
      }
      return translations[key] || key
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

const mockProfileData = {
  id: 123,
  full_name: 'Doe John',
  first_name: 'John',
  last_name: 'Doe',
  middle_name: 'Michael',
  email: 'john@example.com',
  tax_id: '1234567890',
  phone_primary: '+380501234567',
  phone_secondary: '+380671234567',
  date_of_birth: '1990-01-15',
  age: 36,
  priority_score: 50,
  priority_level: 'medium',
  status: 'active',
  is_bankrupt: false,
  is_deceased: false,
  is_fraudster: false,
  is_military: false,
  has_nbu_complaint: false,
  tags: [],
  passport: null,
  employment: null,
  recommenders: [
    {
      id: 10,
      contact_value: '+380509999999',
      contact_type_id: 7,
      contact_type_name: 'Third party mobile phone',
      comment: null,
    },
    {
      id: 11,
      contact_value: '+380501234567',
      contact_type_id: 1,
      contact_type_name: 'Mobile phone',
      comment: null,
    },
    {
      id: 12,
      contact_value: '+380671234567',
      contact_type_id: 2,
      contact_type_name: 'Home phone',
      comment: null,
    },
  ],
  addresses: [
    {
      id: 20,
      address_type: 'registration',
      full_address: 'Ukraine, Kyiv, вул. Main, буд. 10, кв. 5',
      country: 'Ukraine',
      region: 'Kyiv',
      city: 'Kyiv',
      street: 'Main',
      building: '10',
      apartment: '5',
      postal_code: '01001',
      is_primary: true,
    },
  ],
  additional_phones: [],
  comments: [],
}

describe('EditClientModal', () => {
  const mockOnClose = vi.fn()
  const mockUpdateClientAsync = vi.fn().mockResolvedValue(undefined)
  const mockCreateContactAsync = vi.fn().mockResolvedValue(undefined)
  const mockUpdateContactAsync = vi.fn().mockResolvedValue(undefined)
  const mockDeleteContactAsync = vi.fn().mockResolvedValue(undefined)
  const mockCreateAddress = vi.fn()
  const mockUpdateAddress = vi.fn()
  const mockDeleteAddress = vi.fn()
  const mockCreateContact = vi.fn()
  const mockUpdateContact = vi.fn()
  const mockDeleteContact = vi.fn()
  const mockUpdateEmployment = vi.fn()
  const mockUpdatePassport = vi.fn()

  const defaultProps = {
    open: true,
    clientId: 123,
    onClose: mockOnClose,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useHasPermission).mockReturnValue(true)

    vi.mocked(useClientsModule.useClientProfile).mockReturnValue({
      data: mockProfileData,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useClientsModule.useClientProfile>)

    vi.mocked(useClientsModule.useUpdateClient).mockReturnValue({
      mutateAsync: mockUpdateClientAsync,
      isPending: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useCreateAddress).mockReturnValue({
      mutate: mockCreateAddress,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useUpdateAddress).mockReturnValue({
      mutate: mockUpdateAddress,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useDeleteAddress).mockReturnValue({
      mutate: mockDeleteAddress,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useCreateContact).mockReturnValue({
      mutate: mockCreateContact,
      mutateAsync: mockCreateContactAsync,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useUpdateContact).mockReturnValue({
      mutate: mockUpdateContact,
      mutateAsync: mockUpdateContactAsync,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useDeleteContact).mockReturnValue({
      mutate: mockDeleteContact,
      mutateAsync: mockDeleteContactAsync,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useUpdateEmployment).mockReturnValue({
      mutate: mockUpdateEmployment,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useUpdatePassport).mockReturnValue({
      mutate: mockUpdatePassport,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useContactTypes).mockReturnValue({
      data: [
        { id: 7, code: 'third_party_mobile', name: 'Third party mobile phone', is_phone: true },
      ],
      isLoading: false,
      isError: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Modal Rendering', () => {
    it('should render modal with title', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Edit Client')).toBeInTheDocument()
    })

    it('should render personal info section with populated fields', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Personal Information')).toBeInTheDocument()
      expect(screen.getByDisplayValue('John')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Michael')).toBeInTheDocument()
    })

    it('should display tax_id as editable', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const taxInput = screen.getByDisplayValue('1234567890')
      expect(taxInput).toBeInTheDocument()
      expect(taxInput).not.toBeDisabled()
    })

    it('should render phone numbers section', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Phone Numbers')).toBeInTheDocument()
      expect(screen.getByDisplayValue('+380501234567')).toBeInTheDocument()
      expect(screen.getByDisplayValue('+380671234567')).toBeInTheDocument()
    })

    it('should render addresses section with existing addresses', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Addresses')).toBeInTheDocument()
      expect(screen.getByText(/Main/)).toBeInTheDocument()
    })

    it('should render contacts section with existing contacts', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Contacts & Referrals')).toBeInTheDocument()
      expect(screen.getByText(/\+380509999999/)).toBeInTheDocument()
    })
  })

  describe('Personal Info Save', () => {
    it('should call updateClient when saving personal info', async () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-client-save-personal'))

      await waitFor(() => {
        expect(mockUpdateClientAsync).toHaveBeenCalled()
      })
    })

    it('should show success toast on successful save', async () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-client-save-personal'))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })
    })

    it('should show inline error on failed save', async () => {
      mockUpdateClientAsync.mockRejectedValueOnce({
        response: { data: { detail: 'Validation failed' } },
      })

      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-client-save-personal'))

      await waitFor(() => {
        expect(screen.getByText('Validation failed')).toBeInTheDocument()
      })
    })
  })

  describe('Date of Birth', () => {
    it('should render date_of_birth input with profile value', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Date of Birth')).toBeInTheDocument()
      expect(screen.getByDisplayValue('1990-01-15')).toBeInTheDocument()
    })

    it('should include date_of_birth in save payload', async () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-client-save-personal'))

      await waitFor(() => {
        expect(mockUpdateClientAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              date_of_birth: '1990-01-15',
            }),
          })
        )
      })
    })

    it('should include tax_id in save payload', async () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-client-save-personal'))

      await waitFor(() => {
        expect(mockUpdateClientAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              tax_id: '1234567890',
            }),
          })
        )
      })
    })
  })

  describe('Address Management', () => {
    it('should show Add Address button', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Add Address')).toBeInTheDocument()
    })

    it('should show address form when Add Address is clicked', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByText('Add Address'))

      expect(screen.getByText('Address Type')).toBeInTheDocument()
    })

    it('should show edit and delete buttons for existing addresses', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getAllByTestId('edit-address-btn').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('delete-address-btn').length).toBeGreaterThan(0)
    })

    it('should show inline edit form when edit button is clicked', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-address-btn'))

      const kyivInputs = screen.getAllByDisplayValue('Kyiv')
      expect(kyivInputs.length).toBe(2) // region + city
      expect(screen.getByDisplayValue('Main')).toBeInTheDocument()
      expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    })

    it('should call updateAddress when saving address edit', async () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-address-btn'))

      const saveButtons = screen.getAllByText('Save Changes')
      const addressSaveBtn = saveButtons[saveButtons.length - 1]
      fireEvent.click(addressSaveBtn)

      await waitFor(() => {
        expect(mockUpdateAddress).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: 123,
            addressId: 20,
          }),
          expect.anything()
        )
      })
    })
  })

  describe('Contact Management', () => {
    it('should show Add Contact button', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByText('Add Contact')).toBeInTheDocument()
    })

    it('should show contact form when Add Contact is clicked', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByText('Add Contact'))

      expect(screen.getByText('Contact type')).toBeInTheDocument()
    })

    it('should show edit and delete buttons for existing contacts', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getAllByTestId('edit-contact-btn').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('delete-contact-btn').length).toBeGreaterThan(0)
    })

    it('should show inline edit form when edit button is clicked', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const editButtons = screen.getAllByTestId('edit-contact-btn')
      fireEvent.click(editButtons[0])

      expect(screen.getByDisplayValue('+380509999999')).toBeInTheDocument()
    })

    it('should call updateContact when saving contact edit', async () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const editButtons = screen.getAllByTestId('edit-contact-btn')
      fireEvent.click(editButtons[0])

      const saveButtons = screen.getAllByText('Save Changes')
      const contactSaveBtn = saveButtons[saveButtons.length - 1]
      fireEvent.click(contactSaveBtn)

      await waitFor(() => {
        expect(mockUpdateContact).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: 123,
            contactId: 10,
          }),
          expect.anything()
        )
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state while profile is loading', () => {
      vi.mocked(useClientsModule.useClientProfile).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useClientsModule.useClientProfile>)

      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getByTestId('edit-modal-loading')).toBeInTheDocument()
    })
  })

  describe('Modal Close', () => {
    it('should call onClose when Close is clicked', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByText('Close'))

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should not render when open is false', () => {
      render(<EditClientModal {...defaultProps} open={false} />, { wrapper: createWrapper() })

      expect(screen.queryByText('Edit Client')).not.toBeInTheDocument()
    })
  })

  describe('RBAC Field Restrictions', () => {
    const richMockProfile = {
      ...mockProfileData,
      passport: {
        id: 1,
        document_type: 'passport',
        series: 'AB',
        number: '123456',
        issued_by: 'Test Agency',
        issued_date: '2020-01-01',
        expires_date: '2030-01-01',
        gender: 'male',
        record_number: 'RN001',
      },
      employment: {
        id: 1,
        company_name: 'Test Corp',
        position: 'Developer',
        employment_type: 'full_time',
        work_experience_months: 5,
        manager_full_name: 'Boss Man',
        manager_name: null,
        work_phone: '+380441234567',
      },
    }

    describe('Operator (no edit_clients permission)', () => {
      beforeEach(() => {
        vi.mocked(useHasPermission).mockReturnValue(false)
        vi.mocked(useClientsModule.useClientProfile).mockReturnValue({
          data: richMockProfile,
          isLoading: false,
          isError: false,
          error: null,
        } as unknown as ReturnType<typeof useClientsModule.useClientProfile>)
      })

      it('should disable personal info fields for operators', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.getByDisplayValue('John')).toBeDisabled()
        expect(screen.getByDisplayValue('Doe')).toBeDisabled()
        expect(screen.getByDisplayValue('Michael')).toBeDisabled()
        expect(screen.getByDisplayValue('john@example.com')).toBeDisabled()
        expect(screen.getByDisplayValue('1990-01-15')).toBeDisabled()
        expect(screen.getByDisplayValue('1234567890')).toBeDisabled()
      })

      it('should disable passport fields for operators', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.getByDisplayValue('AB')).toBeDisabled()
        expect(screen.getByDisplayValue('123456')).toBeDisabled()
        expect(screen.getByDisplayValue('Test Agency')).toBeDisabled()
      })

      it('should disable work info fields for operators', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.getByDisplayValue('Test Corp')).toBeDisabled()
        expect(screen.getByDisplayValue('Developer')).toBeDisabled()
        expect(screen.getByDisplayValue('+380441234567')).toBeDisabled()
      })

      it('should keep phone fields editable for operators', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.getByDisplayValue('+380501234567')).not.toBeDisabled()
        expect(screen.getByDisplayValue('+380671234567')).not.toBeDisabled()
      })

      it('should hide document and work save buttons for operators', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.queryByTestId('edit-client-save-personal')).not.toBeInTheDocument()
        expect(screen.queryByTestId('edit-client-save-passport')).not.toBeInTheDocument()
        expect(screen.getByTestId('edit-client-save-phones')).toBeInTheDocument()
      })

      it('should allow contact CRUD for operators', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.getByText('Add Contact')).toBeInTheDocument()
        expect(screen.getAllByTestId('edit-contact-btn').length).toBeGreaterThan(0)
        expect(screen.getAllByTestId('delete-contact-btn').length).toBeGreaterThan(0)
      })

      it('should hide address management buttons for operators', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.queryByText('Add Address')).not.toBeInTheDocument()
        expect(screen.queryAllByTestId('edit-address-btn')).toHaveLength(0)
        expect(screen.queryAllByTestId('delete-address-btn')).toHaveLength(0)
      })

      it('should not call updateClient for operators (phones saved via contacts)', async () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        fireEvent.click(screen.getByTestId('edit-client-save-phones'))

        await waitFor(() => {
          expect(mockUpdateClientAsync).not.toHaveBeenCalled()
        })
      })
    })

    describe('Admin/Supervisor (has edit_clients permission)', () => {
      beforeEach(() => {
        vi.mocked(useClientsModule.useClientProfile).mockReturnValue({
          data: richMockProfile,
          isLoading: false,
          isError: false,
          error: null,
        } as unknown as ReturnType<typeof useClientsModule.useClientProfile>)
      })

      it('should enable all personal info fields', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.getByDisplayValue('John')).not.toBeDisabled()
        expect(screen.getByDisplayValue('Doe')).not.toBeDisabled()
        expect(screen.getByDisplayValue('1234567890')).not.toBeDisabled()
      })

      it('should show all save buttons', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.getByTestId('edit-client-save-personal')).toBeInTheDocument()
        expect(screen.getByTestId('edit-client-save-passport')).toBeInTheDocument()
        expect(screen.getByTestId('edit-client-save-phones')).toBeInTheDocument()
      })

      it('should show address management buttons', () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        expect(screen.getByText('Add Address')).toBeInTheDocument()
        expect(screen.getAllByTestId('edit-address-btn').length).toBeGreaterThan(0)
        expect(screen.getAllByTestId('delete-address-btn').length).toBeGreaterThan(0)
      })
    })
  })
})
