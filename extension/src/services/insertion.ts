import type { InsertResult } from './messages'

export async function insertApprovedPrompt(prompt: string): Promise<InsertResult> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return { ok: false, error: 'Extension messaging is unavailable.' }
  try {
    return await chrome.runtime.sendMessage({ type: 'INSERT_PROMPT', prompt, approved: true }) as InsertResult
  } catch {
    return { ok: false, error: 'Could not contact the active tab.' }
  }
}
