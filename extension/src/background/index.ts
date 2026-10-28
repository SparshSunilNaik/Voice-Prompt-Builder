import {
  isInsertMessage,
  isMicrophonePageResult,
  supportedHostname,
  type InsertResult,
  type MicrophonePermissionResultMessage,
} from '../services/messages'

const permissionPageUrl = chrome.runtime.getURL('microphone-permission.html')
const panelUrl = chrome.runtime.getURL('index.html')
let permissionTabId: number | undefined
let openingPermissionTab: Promise<chrome.tabs.Tab> | null = null
void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => undefined)

async function getOrOpenPermissionTab(): Promise<chrome.tabs.Tab> {
  if (permissionTabId !== undefined) {
    try {
      const existing = await chrome.tabs.get(permissionTabId)
      await chrome.tabs.update(permissionTabId, { active: true })
      return existing
    } catch {
      permissionTabId = undefined
    }
  }
  const [existing] = await chrome.tabs.query({ url: `${permissionPageUrl}*` })
  if (existing?.id !== undefined) {
    permissionTabId = existing.id
    await chrome.tabs.update(existing.id, { active: true })
    return existing
  }
  const created = await chrome.tabs.create({ url: permissionPageUrl, active: true })
  permissionTabId = created.id
  return created
}

async function openPermissionTab(): Promise<chrome.tabs.Tab> {
  if (!openingPermissionTab) {
    openingPermissionTab = getOrOpenPermissionTab().finally(() => { openingPermissionTab = null })
  }
  return openingPermissionTab
}

async function broadcastPermissionResult(
  status: MicrophonePermissionResultMessage['status'],
  tabId?: number,
) {
  await chrome.runtime.sendMessage({
    type: 'MICROPHONE_PERMISSION_RESULT',
    status,
    tabId,
  } satisfies MicrophonePermissionResultMessage).catch(() => undefined)
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => undefined)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId !== permissionTabId) return
  permissionTabId = undefined
  void broadcastPermissionResult('cancelled', tabId)
})

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false
  const trustedPanel = sender.url?.split(/[?#]/)[0] === panelUrl
  if ((message as { type?: string })?.type === 'GET_INSERT_TARGET' && trustedPanel) {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => sendResponse(tab?.id && supportedHostname(tab.url) ? { tabId: tab.id, url: tab.url, title: tab.title || new URL(tab.url!).hostname } : null)).catch(() => sendResponse(null))
    return true
  }

  if ((message as { type?: string })?.type === 'OPEN_MICROPHONE_PERMISSION') {
    if (!trustedPanel) return false
    void openPermissionTab().then(
      (tab) => sendResponse({ ok: true, tabId: tab.id }),
      () => sendResponse({ ok: false, error: 'Chrome could not open the microphone permission page.' }),
    )
    return true
  }

  if ((message as { type?: string })?.type === 'CANCEL_MICROPHONE_PERMISSION') {
    if (!trustedPanel) return false
    const requestedTabId = permissionTabId
    permissionTabId = undefined
    if (requestedTabId !== undefined) void chrome.tabs.remove(requestedTabId).catch(() => undefined)
    void broadcastPermissionResult('cancelled', requestedTabId)
    sendResponse({ ok: true })
    return false
  }

  if (isMicrophonePageResult(message) && sender.url?.split(/[?#]/)[0] === permissionPageUrl) {
    const sourceTabId = sender.tab?.id
    void broadcastPermissionResult(message.status, sourceTabId)
    if (message.status === 'granted' || message.status === 'cancelled') {
      permissionTabId = undefined
      if (sourceTabId !== undefined) void chrome.tabs.remove(sourceTabId).catch(() => undefined)
    }
    sendResponse({ ok: true })
    return false
  }

  if (!trustedPanel || !isInsertMessage(message)) return false
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !supportedHostname(tab.url)) {
      sendResponse({ ok: false, error: 'Open ChatGPT, Claude, or Gemini in the active tab, then try again.' })
      return
    }
    if (tab.id !== message.targetTabId || tab.url !== message.targetUrl) {
      sendResponse({ ok: false, error: 'The destination tab changed. Refresh the destination, review it, then approve again.' })
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
