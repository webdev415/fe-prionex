/**
 * Factoring Agreements API client.
 *
 * Backed by ``client-service`` at ``/api/v1/factoring-agreements``. The GET
 * list returns ALL agreements (global, not project-scoped) and backs the
 * Bulk Document Import agreement dropdown. Guarded by ``import_documents``.
 */

import { api } from '@/lib/api'
import type { FactoringAgreementPage, ListFactoringAgreementsParams } from '../types'

const BASE = '/api/v1/factoring-agreements'

export async function listFactoringAgreements(
  params: ListFactoringAgreementsParams = {}
): Promise<FactoringAgreementPage> {
  const response = await api.get<FactoringAgreementPage>(BASE, {
    params: {
      page: params.page ?? 1,
      page_size: params.page_size ?? 50,
      ...(params.search ? { search: params.search } : {}),
    },
  })
  return response.data
}

export const factoringAgreementsApi = { list: listFactoringAgreements }
