/**
 * Bulk Document Import API client.
 *
 * Backed by ``import-service`` at ``/api/v1/import/documents``. Handles the
 * example-archive download and the chunked / resumable ZIP upload
 * (init -> chunk* -> complete), which stages the archive for the
 * client-service worker.
 */

import { api } from '@/lib/api'

const BASE = '/api/v1/import/documents'

// 20 MB parts — small enough to avoid gateway timeouts / buffering, large
// enough to keep the request count reasonable for a 10 GB archive.
export const UPLOAD_CHUNK_SIZE = 20 * 1024 * 1024

export interface UploadInitParams {
  original_filename: string
  total_size: number
}

interface UploadInitResponse {
  upload_id: string
  bytes_received: number
  total_size: number
}

// Result of the upload phase (assemble + validate ZIP). No job yet — the
// import is started separately via startImport().
export interface UploadResult {
  upload_id: string
  status: string
  original_filename: string
  total_size: number
}

interface StartImportResponse {
  upload_id: string
  job_id: number
  batch_id: string
  status: string
}

export type DocumentImportJobStatus =
  | 'pending'
  | 'validated'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface DocumentImportJobCounts {
  matched_folders: number
  files_attached: number
  duplicate_skipped: number
  skipped_no_match: number
  executables_blocked: number
  oversized_skipped: number
  errors: number
}

export interface DocumentImportJob {
  job_id: number
  status: DocumentImportJobStatus
  successful_records: number
  counts: DocumentImportJobCounts | null
  error: string | null
  processed: number | null
  total: number | null
  progress_percent: number | null
  created_at: string | null
  completed_at: string | null
}

export async function downloadExampleArchive(): Promise<Blob> {
  const response = await api.get(`${BASE}/example-archive`, {
    responseType: 'blob',
  })
  return response.data
}

async function initUpload(params: UploadInitParams): Promise<UploadInitResponse> {
  const response = await api.post<UploadInitResponse>(`${BASE}/upload/init`, params)
  return response.data
}

async function uploadChunk(uploadId: string, offset: number, chunk: Blob): Promise<void> {
  await api.put(`${BASE}/upload/${uploadId}/chunk`, chunk, {
    params: { offset },
    headers: { 'Content-Type': 'application/octet-stream' },
  })
}

async function completeUpload(uploadId: string): Promise<UploadResult> {
  const response = await api.post<UploadResult>(`${BASE}/upload/${uploadId}/complete`)
  return response.data
}

/**
 * Upload a ZIP in chunks: init -> sequential chunk uploads -> complete.
 * Calls ``onProgress`` (0-100) after each chunk. Returns the staged upload
 * (no job yet — start the import separately with startImport()).
 */
export async function uploadArchiveInChunks(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<UploadResult> {
  const total = file.size
  const { upload_id } = await initUpload({
    original_filename: file.name,
    total_size: total,
  })

  let offset = 0
  while (offset < total) {
    // User-initiated cancel: stop sending and delete the partial staged file
    // (the .zip.part chunks sent so far + its .meta.json) so nothing is orphaned.
    if (signal?.aborted) {
      await abortUpload(upload_id).catch(() => {})
      throw new DOMException('Upload cancelled', 'AbortError')
    }
    const end = Math.min(offset + UPLOAD_CHUNK_SIZE, total)
    await uploadChunk(upload_id, offset, file.slice(offset, end))
    offset = end
    onProgress?.(Math.round((offset / total) * 100))
  }

  return completeUpload(upload_id)
}

/**
 * Start processing a staged upload: binds the agreement + document type,
 * creates the import job and dispatches the worker. This is the explicit
 * "assign" step — nothing is attached until it's called.
 */
export async function startImport(
  uploadId: string,
  agreementId: number,
  documentTypeId: number
): Promise<StartImportResponse> {
  const response = await api.post<StartImportResponse>(`${BASE}/upload/${uploadId}/start`, {
    agreement_id: agreementId,
    document_type_id: documentTypeId,
  })
  return response.data
}

/** Abandon a staged upload and delete its partial file (e.g. on re-select). */
export async function abortUpload(uploadId: string): Promise<void> {
  await api.delete(`${BASE}/upload/${uploadId}`)
}

/** Fetch a document import job's status/counts (polled by the result banner). */
export async function getJobStatus(jobId: number): Promise<DocumentImportJob> {
  const response = await api.get<DocumentImportJob>(`${BASE}/jobs/${jobId}/status`)
  return response.data
}

export const documentImportApi = {
  downloadExampleArchive,
  uploadArchiveInChunks,
  startImport,
  abortUpload,
  getJobStatus,
}
