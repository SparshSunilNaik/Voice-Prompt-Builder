import { isInsertMessage, supportedHostname, type InsertResult } from '../services/messages'

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (result: InsertResult) => void) => {
  if (sender.id !== chrome.runtime.id || !isInsertMessage(message) || !supportedHostname(location.href)) return false
  sendResponse({ ok: false, error: 'No supported composer was detected on this page.' })
  return false
})
