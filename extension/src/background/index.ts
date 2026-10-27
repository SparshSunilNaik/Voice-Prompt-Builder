import { isInsertMessage, supportedHostname, type InsertResult } from '../services/messages'

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => undefined)
})

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (result: InsertResult) => void) => {
  if (sender.id !== chrome.runtime.id || !isInsertMessage(message)) return false
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !supportedHostname(tab.url)) {
      sendResponse({ ok: false, error: 'Open ChatGPT, Claude, or Gemini in the active tab, then try again.' })
      return
    }
    try {
      const result = await chrome.tabs.sendMessage(tab.id, message) as InsertResult
      sendResponse(result?.ok ? result : { ok: false, error: result?.error || 'The chat composer could not be updated.' })
    } catch {
      sendResponse({ ok: false, error: 'The page is not ready. Refresh the supported chat tab and try again.' })
    }
  })()
  return true
})
