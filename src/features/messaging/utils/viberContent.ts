import type {
  MessagingChannel,
  MessagingDraft,
  MessagingViberContent,
  MessagingViberContentType,
} from '../api/types'

export const MAX_VIBER_IMAGES = 1

/** Where the attachment came from — controls whether remove deletes the server file. */
export type MessagingViberImageSource = 'draft' | 'upload'

/** Local Viber image row (blob preview + server URL for My2 dispatch). */
export interface MessagingViberImageAttachment {
  id: string
  previewUrl: string
  publicUrl: string
  storedName: string | null
  fileName: string
  /** `draft` = template URL (detach only in send modals); `upload` = uploaded this session. */
  source: MessagingViberImageSource
  uploading?: boolean
}

export function shouldDeleteViberImageOnServer(
  attachment: MessagingViberImageAttachment,
  removalMode: 'compose' | 'template-editor'
): boolean {
  if (removalMode === 'template-editor') return Boolean(attachment.storedName)
  return attachment.source === 'upload' && Boolean(attachment.storedName)
}

export function viberPublicUrls(images: MessagingViberImageAttachment[]): string[] {
  return images
    .filter((item) => !item.uploading && item.publicUrl.trim())
    .map((item) => item.publicUrl.trim())
}

export function storedNameFromViberImageUrl(url: string): string | null {
  const match = url.trim().match(/\/viber\/images\/([^/?#]+)$/i)
  return match?.[1] ?? null
}

export function revokeViberImagePreviews(images: MessagingViberImageAttachment[]): void {
  for (const image of images) {
    if (image.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(image.previewUrl)
    }
  }
}

export function resetViberImages(
  images: MessagingViberImageAttachment[]
): MessagingViberImageAttachment[] {
  revokeViberImagePreviews(images)
  return []
}

export function resolveViberImageUrls(
  content: MessagingViberContent | Record<string, unknown> | undefined
): string[] {
  if (!content || typeof content !== 'object') return []
  const raw = content as Record<string, unknown>
  const fromList = raw.url_images
  if (Array.isArray(fromList)) {
    return fromList
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  const single = raw.url_image
  if (typeof single === 'string' && single.trim()) {
    return [single.trim()]
  }
  return []
}

export function buildViberContentPayload(
  enabled: boolean,
  fields: {
    urlImages: string[]
    buttonName: string
    buttonUrl: string
  }
): MessagingViberContent | undefined {
  if (!enabled) return undefined
  const url_images = fields.urlImages.map((u) => u.trim()).filter(Boolean)
  const button_name = fields.buttonName.trim() || undefined
  const button_url = fields.buttonUrl.trim() || undefined
  if (!url_images.length && !button_name && !button_url) return undefined

  return {
    url_images,
    url_image: url_images[0],
    button_name,
    button_url,
  }
}

/**
 * Build viber payload for send/campaign APIs. Returns an explicit empty object when the
 * form has no rich fields so the backend does not re-apply draft ``channel_options``.
 */
export function buildViberContentForSend(fields: {
  urlImages: string[]
  buttonName: string
  buttonUrl: string
}): MessagingViberContent | Record<string, never> | null {
  const payload = buildViberContentPayload(true, fields)
  if (payload) return payload
  const hasButton = Boolean(fields.buttonName.trim() && fields.buttonUrl.trim())
  if (fields.urlImages.length === 0 && !hasButton) {
    return { url_images: [] }
  }
  return null
}

export function inferViberContentType(fields: {
  hasMessage: boolean
  hasImage: boolean
  hasButton: boolean
}): MessagingViberContentType {
  const { hasMessage, hasImage, hasButton } = fields
  if (hasMessage && hasImage && hasButton) return 'MESSAGE_IMAGE_AND_BUTTON'
  if (hasMessage && hasButton) return 'MESSAGE_AND_BUTTON'
  if (hasMessage && hasImage) return 'MESSAGE_IMAGE_AND_BUTTON'
  if (hasImage && hasButton) return 'IMAGE_AND_BUTTON'
  if (hasImage) return 'ONLY_IMAGE'
  if (hasButton) return 'ONLY_BUTTON'
  return 'ONLY_MESSAGE'
}

export function viberContentFromSnapshot(
  snapshot: Record<string, unknown> | undefined
): MessagingViberContent | undefined {
  const viber = snapshot?.viber
  if (!viber || typeof viber !== 'object') return undefined
  const raw = viber as Record<string, unknown>
  const url_images = resolveViberImageUrls(raw)
  return {
    content_type: raw.content_type as MessagingViberContentType | undefined,
    url_images,
    url_image: url_images[0],
    button_name: typeof raw.button_name === 'string' ? raw.button_name : undefined,
    button_url: typeof raw.button_url === 'string' ? raw.button_url : undefined,
  }
}

export function viberAttachmentsFromUrls(
  urls: string[],
  source: MessagingViberImageSource = 'draft'
): MessagingViberImageAttachment[] {
  return urls.map((publicUrl) => ({
    id: `viber-img-${crypto.randomUUID()}`,
    previewUrl: publicUrl,
    publicUrl,
    storedName: storedNameFromViberImageUrl(publicUrl),
    fileName: decodeURIComponent(publicUrl.split('/').pop() || 'image.jpg'),
    source,
  }))
}

export function viberContentFromChannelOptions(
  channelOptions: Record<string, unknown> | null | undefined
): MessagingViberContent | undefined {
  if (!channelOptions || typeof channelOptions !== 'object') return undefined
  const viber = channelOptions.viber
  if (!viber || typeof viber !== 'object') return undefined
  return viberContentFromSnapshot({ viber })
}

export function readDraftViberFormState(draft: MessagingDraft | null | undefined): {
  addImage: boolean
  addButton: boolean
  images: MessagingViberImageAttachment[]
  buttonName: string
  buttonUrl: string
} {
  const content = viberContentFromChannelOptions(draft?.channel_options)
  const form = applyViberContentToForm(content)
  return {
    addImage: form.addImage,
    addButton: form.addButton,
    images: viberAttachmentsFromUrls(form.urlImages, 'draft'),
    buttonName: form.buttonName,
    buttonUrl: form.buttonUrl,
  }
}

export function buildDraftChannelOptions(
  channel: MessagingChannel,
  fields: {
    urlImages: string[]
    buttonName: string
    buttonUrl: string
  }
): Record<string, unknown> | null {
  if (channel !== 'viber') return null
  const viber = buildViberContentPayload(true, fields)
  return viber ? { viber } : {}
}

export function applyViberContentToForm(content: MessagingViberContent | undefined): {
  addImage: boolean
  addButton: boolean
  urlImages: string[]
  buttonName: string
  buttonUrl: string
} {
  if (!content) {
    return {
      addImage: false,
      addButton: false,
      urlImages: [],
      buttonName: '',
      buttonUrl: '',
    }
  }
  const urlImages = resolveViberImageUrls(content)
  return {
    addImage: urlImages.length > 0,
    addButton: Boolean(content.button_name && content.button_url),
    urlImages,
    buttonName: content.button_name ?? '',
    buttonUrl: content.button_url ?? '',
  }
}
