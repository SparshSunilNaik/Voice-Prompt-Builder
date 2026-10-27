import type {
  MicrophonePermissionResultMessage,
} from './messages'

export type PermissionFlowResult = 'granted' | 'cancelled'
type DeniedListener = () => void

let activeRequest: Promise<PermissionFlowResult> | null = null
let cancelActiveRequest: (() => void) | null = null
const deniedListeners = new Set<DeniedListener>()

async function microphonePermissionState(): Promise<PermissionState> {
  if (!navigator.permissions?.query) return 'prompt'
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return status.state
  } catch {
    return 'prompt'
  }
}

function isPermissionResult(message: unknown): message is MicrophonePermissionResultMessage {
  if (!message || typeof message !== 'object') return false
  const candidate = message as Partial<MicrophonePermissionResultMessage>
  return candidate.type === 'MICROPHONE_PERMISSION_RESULT'
    && ['granted', 'denied', 'cancelled'].includes(candidate.status ?? '')
}

async function openPermissionFlow(): Promise<PermissionFlowResult> {
  if (await microphonePermissionState() === 'granted') return 'granted'
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new Error('Chrome extension permission messaging is unavailable.')
  }

  return new Promise<PermissionFlowResult>((resolve, reject) => {
    let permissionTabId: number | undefined
    let settled = false
    const cleanup = () => {
      chrome.runtime.onMessage.removeListener(onMessage)
      chrome.tabs.onRemoved.removeListener(onTabRemoved)
      cancelActiveRequest = null
    }
    const finish = (result: PermissionFlowResult) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }
    const onMessage = (message: unknown) => {
      if (!isPermissionResult(message)) return
      if (message.tabId !== undefined && permissionTabId !== undefined && message.tabId !== permissionTabId) return
      if (message.status === 'denied') {
        deniedListeners.forEach((listener) => listener())
        return
      }
      finish(message.status)
    }
    const onTabRemoved = (tabId: number) => {
      if (permissionTabId === tabId) finish('cancelled')
    }
    chrome.runtime.onMessage.addListener(onMessage)
    chrome.tabs.onRemoved.addListener(onTabRemoved)
    cancelActiveRequest = () => {
      void chrome.runtime.sendMessage({ type: 'CANCEL_MICROPHONE_PERMISSION', tabId: permissionTabId })
      finish('cancelled')
    }
    void chrome.runtime.sendMessage({ type: 'OPEN_MICROPHONE_PERMISSION' }).then(
      (response: { ok?: boolean; tabId?: number; error?: string } | undefined) => {
        if (!response?.ok || response.tabId === undefined) {
          cleanup()
          reject(new Error(response?.error || 'Could not open the microphone permission page.'))
          return
        }
        permissionTabId = response.tabId
      },
      () => {
        cleanup()
        reject(new Error('Could not contact the extension background worker. Reload the extension.'))
      },
    )
  })
}

export function requestMicrophonePermission(onDenied?: DeniedListener): Promise<PermissionFlowResult> {
  if (onDenied) deniedListeners.add(onDenied)
  if (!activeRequest) {
    activeRequest = openPermissionFlow().finally(() => {
      activeRequest = null
      deniedListeners.clear()
    })
  }
  return activeRequest
}

export function cancelMicrophonePermissionRequest() {
  cancelActiveRequest?.()
}

export async function currentMicrophonePermission(): Promise<PermissionState> {
  return microphonePermissionState()
}
