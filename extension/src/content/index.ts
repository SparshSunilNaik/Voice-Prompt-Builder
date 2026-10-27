import { isInsertMessage, supportedHostname, type InsertResult } from '../services/messages'
import { insertForPage } from '../adapters'

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (result: InsertResult) => void) => {
  if (sender.id !== chrome.runtime.id || !isInsertMessage(message) || !supportedHostname(location.href)) return false
  void insertForPage(message.prompt).then(sendResponse).catch(() => sendResponse({ ok: false, error: 'The composer rejected insertion. Use Copy instead.' }))
  return true
})
