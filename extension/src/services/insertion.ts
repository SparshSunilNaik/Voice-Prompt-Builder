import type { InsertResult, InsertionTarget } from './messages'

export async function getInsertionTarget(): Promise<InsertionTarget | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null
  try {
    const target = await chrome.runtime.sendMessage({ type: 'GET_INSERT_TARGET' }) as InsertionTarget
    return target && Number.isInteger(target.tabId) && typeof target.url === 'string' ? target : null
  } catch { return null }
}

export async function insertApprovedPrompt(prompt: string, target?: InsertionTarget | null): Promise<InsertResult> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return { ok: false, error: 'Extension messaging is unavailable.' }
  try {
    if (!target) return { ok: false, error: 'Select a supported chat tab and refresh the insertion destination.' }
    const result = await chrome.runtime.sendMessage({ type: 'INSERT_PROMPT', prompt, approved: true, targetTabId: target.tabId, targetUrl: target.url }) as InsertResult | undefined
    return result && typeof result.ok === 'boolean' ? result : { ok: false, error: 'The chat tab did not confirm insertion.' }
  } catch {
    return { ok: false, error: 'Could not contact the active tab.' }
  }
}

export async function copyPrompt(prompt: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(prompt)
    return true
  } catch {
    return false
  }
}
