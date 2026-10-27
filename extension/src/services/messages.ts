export const SUPPORTED_HOSTS = ['chatgpt.com', 'claude.ai', 'gemini.google.com'] as const

export interface InsertPromptMessage {
  type: 'INSERT_PROMPT'
  prompt: string
  approved: true
}

export interface InsertResult {
  ok: boolean
  platform?: string
  error?: string
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
