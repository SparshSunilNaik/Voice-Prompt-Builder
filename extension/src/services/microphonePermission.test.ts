import { afterEach, beforeEach, expect, test, vi } from 'vitest'

type Listener = (...args: never[]) => void

class MockChromeEvent {
  listeners = new Set<Listener>()
  addListener = vi.fn((listener: Listener) => { this.listeners.add(listener) })
  removeListener = vi.fn((listener: Listener) => { this.listeners.delete(listener) })
  emit(...args: unknown[]) {
    this.listeners.forEach((listener) => (listener as (...values: unknown[]) => void)(...args))
  }
}

function setupChrome(tabId = 41) {
  const onMessage = new MockChromeEvent()
  const onRemoved = new MockChromeEvent()
  const sendMessage = vi.fn((message: { type: string }) => {
    if (message.type === 'OPEN_MICROPHONE_PERMISSION') return Promise.resolve({ ok: true, tabId })
    return Promise.resolve({ ok: true })
  })
  vi.stubGlobal('chrome', {
    runtime: { sendMessage, onMessage },
    tabs: { onRemoved },
  })
  return { onMessage, onRemoved, sendMessage, tabId }
}

function setPermission(state: PermissionState) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state }) },
  })
}

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

test('records directly when microphone permission is already granted', async () => {
  const chromeMock = setupChrome()
  setPermission('granted')
  const { requestMicrophonePermission } = await import('./microphonePermission')
  await expect(requestMicrophonePermission()).resolves.toBe('granted')
  expect(chromeMock.sendMessage).not.toHaveBeenCalled()
})

test('prompt state opens one permission tab for concurrent requests', async () => {
  const chromeMock = setupChrome()
  setPermission('prompt')
  const { requestMicrophonePermission } = await import('./microphonePermission')
  const first = requestMicrophonePermission()
  const second = requestMicrophonePermission()
  await vi.waitFor(() => expect(chromeMock.sendMessage).toHaveBeenCalledTimes(1))
  chromeMock.onMessage.emit({
    type: 'MICROPHONE_PERMISSION_RESULT', status: 'granted', tabId: chromeMock.tabId,
  })
  await expect(Promise.all([first, second])).resolves.toEqual(['granted', 'granted'])
})

test('denied status remains recoverable and later granted status resumes the request', async () => {
  const chromeMock = setupChrome()
  setPermission('denied')
  const denied = vi.fn()
  const { requestMicrophonePermission } = await import('./microphonePermission')
  const permission = requestMicrophonePermission(denied)
  await vi.waitFor(() => expect(chromeMock.sendMessage).toHaveBeenCalledTimes(1))
  chromeMock.onMessage.emit({
    type: 'MICROPHONE_PERMISSION_RESULT', status: 'denied', tabId: chromeMock.tabId,
  })
  expect(denied).toHaveBeenCalledOnce()
  const state = await Promise.race([permission.then(() => 'settled'), Promise.resolve('pending')])
  expect(state).toBe('pending')
  chromeMock.onMessage.emit({
    type: 'MICROPHONE_PERMISSION_RESULT', status: 'granted', tabId: chromeMock.tabId,
  })
  await expect(permission).resolves.toBe('granted')
})

test('closing the permission tab cancels without reopening it', async () => {
  const chromeMock = setupChrome()
  setPermission('prompt')
  const { requestMicrophonePermission } = await import('./microphonePermission')
  const permission = requestMicrophonePermission()
  await vi.waitFor(() => expect(chromeMock.sendMessage).toHaveBeenCalledTimes(1))
  chromeMock.onRemoved.emit(chromeMock.tabId)
  await expect(permission).resolves.toBe('cancelled')
  expect(chromeMock.sendMessage).toHaveBeenCalledTimes(1)
})

test('explicit cancellation closes the active permission flow', async () => {
  const chromeMock = setupChrome()
  setPermission('prompt')
  const { cancelMicrophonePermissionRequest, requestMicrophonePermission } = await import('./microphonePermission')
  const permission = requestMicrophonePermission()
  await vi.waitFor(() => expect(chromeMock.sendMessage).toHaveBeenCalledTimes(1))
  cancelMicrophonePermissionRequest()
  await expect(permission).resolves.toBe('cancelled')
  expect(chromeMock.sendMessage).toHaveBeenLastCalledWith({
    type: 'CANCEL_MICROPHONE_PERMISSION', tabId: chromeMock.tabId,
  })
})

test('cancellation during the initial permission query never opens a stale permission tab', async () => {
  const chromeMock = setupChrome()
  let resolve!: (value: { state: string }) => void
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: () => new Promise((done) => { resolve = done }) } })
  const { cancelMicrophonePermissionRequest, requestMicrophonePermission } = await import('./microphonePermission')
  const pending = requestMicrophonePermission()
  cancelMicrophonePermissionRequest()
  resolve({ state: 'prompt' })
  await expect(pending).resolves.toBe('cancelled')
  expect(chromeMock.sendMessage).not.toHaveBeenCalled()
})
