export const SUPPORTED_HOSTS = ['chatgpt.com', 'claude.ai', 'gemini.google.com'] as const

export interface InsertPromptMessage {
  type: 'INSERT_PROMPT'
  prompt: string
  approved: true
  targetTabId?: number
  targetUrl?: string
}

export interface InsertionTarget { tabId: number; url: string; title: string }

export interface InsertResult {
  ok: boolean
  platform?: string
  error?: string
}

export type MicrophonePermissionStatus = 'granted' | 'denied' | 'cancelled'

export interface OpenMicrophonePermissionMessage {
  type: 'OPEN_MICROPHONE_PERMISSION'
}

export interface CancelMicrophonePermissionMessage {
  type: 'CANCEL_MICROPHONE_PERMISSION'
  tabId?: number
}

export interface MicrophonePermissionPageResultMessage {
  type: 'MICROPHONE_PERMISSION_PAGE_RESULT'
  status: MicrophonePermissionStatus
}

export interface MicrophonePermissionResultMessage {
  type: 'MICROPHONE_PERMISSION_RESULT'
  status: MicrophonePermissionStatus
  tabId?: number
}

export function isMicrophonePageResult(
  value: unknown,
): value is MicrophonePermissionPageResultMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MicrophonePermissionPageResultMessage>
  return candidate.type === 'MICROPHONE_PERMISSION_PAGE_RESULT'
    && ['granted', 'denied', 'cancelled'].includes(candidate.status ?? '')
}

export function isInsertMessage(value: unknown): value is InsertPromptMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<InsertPromptMessage>
  return candidate.type === 'INSERT_PROMPT' && candidate.approved === true && typeof candidate.prompt === 'string' && candidate.prompt.trim().length > 0 && candidate.prompt.length <= 30_000
}

export function supportedHostname(url: string | undefined): boolean {
  if (!url) return false
  try { return SUPPORTED_HOSTS.includes(new URL(url).hostname as typeof SUPPORTED_HOSTS[number]) } catch { return false }
}
