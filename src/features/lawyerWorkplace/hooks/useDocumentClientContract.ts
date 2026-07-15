import { useCallback, useMemo, useState } from 'react'
import { useLegalClientContracts } from './useLegalClientContracts'

export function useDocumentClientContract(clientId: string, enabled: boolean) {
  const clientIdNumber = Number.parseInt(clientId, 10)
  const hasClient = Number.isFinite(clientIdNumber) && clientIdNumber > 0
  const { data, isLoading } = useLegalClientContracts(hasClient ? clientIdNumber : null, {
    enabled: enabled && hasClient,
  })

  const contracts = useMemo(() => data?.items ?? [], [data?.items])
  const [contractSelection, setContractSelection] = useState({
    clientId: '',
    contractNumber: '',
  })

  const suggestedContractNumber = useMemo(() => {
    if (!hasClient) return ''
    if (contracts.length === 1) return contracts[0]?.contract_number?.trim() ?? ''
    return ''
  }, [contracts, hasClient])

  const contractNumber =
    contractSelection.clientId === clientId && contractSelection.contractNumber !== ''
      ? contractSelection.contractNumber
      : suggestedContractNumber

  const requiresSelection = contracts.length > 1
  const hasValidContract =
    contracts.length === 0 || (requiresSelection ? contractNumber.trim() !== '' : true)

  const setContractNumber = useCallback(
    (value: string) => {
      setContractSelection({ clientId, contractNumber: value })
    },
    [clientId]
  )

  const resetContract = useCallback(() => {
    setContractSelection({ clientId: '', contractNumber: '' })
  }, [])

  return {
    contracts,
    contractsLoading: isLoading,
    contractNumber,
    setContractNumber,
    requiresSelection,
    hasValidContract,
    resetContract,
  }
}
