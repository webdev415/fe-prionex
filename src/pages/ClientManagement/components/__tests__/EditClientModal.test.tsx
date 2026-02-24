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
        'pages.clients.editModal.contactType': 'Contact Type',
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
      }
      return translations[key] || key
    },
  }),
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
      full_name: 'Smith Jane',
      first_name: 'Jane',
      last_name: 'Smith',
      middle_name: null,
      relationship: 'wife',
      phone: '+380509999999',
      notes: null,
      contact_type: 'phone_mobile_third_party',
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
  const mockMutate = vi.fn()
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
      mutate: mockMutate,
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
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useUpdateContact).mockReturnValue({
      mutate: mockUpdateContact,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(useClientsModule.useDeleteContact).mockReturnValue({
      mutate: mockDeleteContact,
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
      expect(screen.getByText(/Smith Jane/)).toBeInTheDocument()
    })
  })

  describe('Personal Info Save', () => {
    it('should call updateClient when saving personal info', async () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const saveButtons = screen.getAllByText('Save Changes')
      fireEvent.click(saveButtons[1])

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled()
      })
    })

    it('should show success toast on successful save', async () => {
      let onSuccessCallback: (() => void) | undefined

      mockMutate.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_data: unknown, options: Record<string, any>) => {
          onSuccessCallback = options?.onSuccess
        }
      )

      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const saveButtons = screen.getAllByText('Save Changes')
      fireEvent.click(saveButtons[1])

      onSuccessCallback?.()

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled()
      })
    })

    it('should show error toast on failed save', async () => {
      let onErrorCallback:
        | ((error: { response?: { data?: { detail?: string } } }) => void)
        | undefined

      mockMutate.mockImplementation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (_data: unknown, options: Record<string, any>) => {
          onErrorCallback = options?.onError
        }
      )

      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      const saveButtons = screen.getAllByText('Save Changes')
      fireEvent.click(saveButtons[1])

      onErrorCallback?.({ response: { data: { detail: 'Validation failed' } } })

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
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

      const saveButtons = screen.getAllByText('Save Changes')
      fireEvent.click(saveButtons[1])

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              date_of_birth: '1990-01-15',
            }),
          }),
          expect.anything()
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

      expect(screen.getByText('Contact Type')).toBeInTheDocument()
    })

    it('should show edit and delete buttons for existing contacts', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      expect(screen.getAllByTestId('edit-contact-btn').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('delete-contact-btn').length).toBeGreaterThan(0)
    })

    it('should show inline edit form when edit button is clicked', () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-contact-btn'))

      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Smith')).toBeInTheDocument()
      expect(screen.getByDisplayValue('+380509999999')).toBeInTheDocument()
    })

    it('should call updateContact when saving contact edit', async () => {
      render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

      fireEvent.click(screen.getByTestId('edit-contact-btn'))

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
        work_experience_years: 5,
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

        const saveButtons = screen.getAllByText('Save Changes')
        expect(saveButtons).toHaveLength(1)
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

      it('should only send phone fields in save payload for operators', async () => {
        render(<EditClientModal {...defaultProps} />, { wrapper: createWrapper() })

        const saveButton = screen.getByText('Save Changes')
        fireEvent.click(saveButton)

        await waitFor(() => {
          expect(mockMutate).toHaveBeenCalledWith(
            expect.objectContaining({
              data: {
                phone_primary: '+380501234567',
                phone_secondary: '+380671234567',
              },
            }),
            expect.anything()
          )
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

        const saveButtons = screen.getAllByText('Save Changes')
        expect(saveButtons).toHaveLength(3)
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
