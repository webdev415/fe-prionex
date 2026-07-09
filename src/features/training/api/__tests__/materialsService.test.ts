import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  archiveMaterial,
  attachMaterialToCall,
  detachMaterialFromCall,
  downloadMaterial,
  listMaterials,
  listMaterialsForCall,
  previewMaterial,
  uploadMaterial,
} from '../materialsService'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: mockApi }))

describe('materialsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listMaterials', () => {
    it('builds query params, dropping undefined filters', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listMaterials({ type: 'pdf', q: 'script', category: 3, limit: 48, offset: 0 })

      const [url, config] = mockApi.get.mock.calls[0]
      expect(url).toBe('/api/v1/quality/materials')
      const params = config.params as URLSearchParams
      expect(params.get('type')).toBe('pdf')
      expect(params.get('q')).toBe('script')
      expect(params.get('category')).toBe('3')
      expect(params.get('limit')).toBe('48')
      expect(params.get('offset')).toBe('0')
    })

    it('omits filters that are not set', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listMaterials({})
      const params = mockApi.get.mock.calls[0][1].params as URLSearchParams
      expect(params.get('type')).toBeNull()
      expect(params.get('q')).toBeNull()
      expect(params.get('category')).toBeNull()
    })
  })

  describe('uploadMaterial', () => {
    it('posts multipart FormData with file + metadata', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1 } })
      const file = new File([new Uint8Array([1, 2, 3])], 'guide.pdf', {
        type: 'application/pdf',
      })
      await uploadMaterial({
        file,
        title: 'Guide',
        description: 'v1',
        category_id: 5,
        tags: ['script', 'opening'],
      })

      const [url, body, config] = mockApi.post.mock.calls[0]
      expect(url).toBe('/api/v1/quality/materials')
      expect(body).toBeInstanceOf(FormData)
      const fd = body as FormData
      expect(fd.get('file')).toBe(file)
      expect(fd.get('title')).toBe('Guide')
      expect(fd.get('description')).toBe('v1')
      expect(fd.get('category_id')).toBe('5')
      expect(fd.get('tags')).toBe('script,opening')
      expect(config.headers['Content-Type']).toBe('multipart/form-data')
    })

    it('omits empty metadata from the FormData', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 2 } })
      const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
      await uploadMaterial({ file })
      const fd = mockApi.post.mock.calls[0][1] as FormData
      expect(fd.get('file')).toBe(file)
      expect(fd.get('title')).toBeNull()
      expect(fd.get('category_id')).toBeNull()
      expect(fd.get('tags')).toBeNull()
    })
  })

  describe('downloadMaterial', () => {
    it('requests a blob from the download endpoint', async () => {
      const blob = new Blob(['data'])
      mockApi.get.mockResolvedValue({ data: blob })
      const result = await downloadMaterial(7)
      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/v1/quality/materials/7/download',
        expect.objectContaining({ responseType: 'blob' })
      )
      expect(result).toBe(blob)
    })
  })

  describe('archiveMaterial', () => {
    it('deletes by id', async () => {
      mockApi.delete.mockResolvedValue({ data: null })
      await archiveMaterial(9)
      expect(mockApi.delete).toHaveBeenCalledWith('/api/v1/quality/materials/9')
    })
  })

  describe('previewMaterial', () => {
    it('requests the file inline as a blob', async () => {
      const blob = new Blob(['%PDF'])
      mockApi.get.mockResolvedValue({ data: blob })
      const result = await previewMaterial(4)
      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/v1/quality/materials/4/download',
        expect.objectContaining({
          responseType: 'blob',
          params: { disposition: 'inline' },
        })
      )
      expect(result).toBe(blob)
    })
  })

  describe('call attachments', () => {
    it('attaches a material to a call', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 1, material_id: 3, call_id: 'abc' } })
      await attachMaterialToCall(3, 'abc-uuid')
      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/quality/materials/3/attachments', {
        call_id: 'abc-uuid',
      })
    })

    it('detaches a material from a call', async () => {
      mockApi.delete.mockResolvedValue({ data: null })
      await detachMaterialFromCall(3, 'abc-uuid')
      expect(mockApi.delete).toHaveBeenCalledWith(
        '/api/v1/quality/materials/3/attachments/abc-uuid'
      )
    })

    it('lists materials for a call', async () => {
      mockApi.get.mockResolvedValue({ data: { data: [], total: 0 } })
      await listMaterialsForCall('abc-uuid')
      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/quality/calls/abc-uuid/materials')
    })
  })
})
