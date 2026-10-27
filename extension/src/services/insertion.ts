import type { InsertResult } from './messages'

export async function insertApprovedPrompt(prompt: string): Promise<InsertResult> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return { ok: false, error: 'Extension messaging is unavailable.' }
  return chrome.runtime.sendMessage({ type: 'INSERT_PROMPT', prompt, approved: true }) as Promise<InsertResult>
}
