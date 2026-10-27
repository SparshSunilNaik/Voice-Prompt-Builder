import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MicrophonePermissionPage } from './MicrophonePermissionPage'

const sendMessage = vi.fn().mockResolvedValue({ ok: true })
const tabsCreate = vi.fn().mockResolvedValue({})

function setPermission(state: PermissionState) {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state }) },
  })
}

beforeEach(() => {
  sendMessage.mockClear()
  tabsCreate.mockClear()
  vi.stubGlobal('chrome', { runtime: { sendMessage }, tabs: { create: tabsCreate } })
})

afterEach(() => vi.unstubAllGlobals())

test('requests access on a clear user action and immediately stops granted tracks', async () => {
  setPermission('prompt')
  const stop = vi.fn()
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
  })
  render(<MicrophonePermissionPage />)
  fireEvent.click(await screen.findByRole('button', { name: /allow microphone/i }))
  await waitFor(() => expect(screen.getByText(/microphone access allowed/i)).toBeVisible())
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
  expect(stop).toHaveBeenCalledOnce()
  expect(sendMessage).toHaveBeenCalledWith({
    type: 'MICROPHONE_PERMISSION_PAGE_RESULT', status: 'granted',
  })
})

test('shows denied recovery instructions and supports retry after settings change', async () => {
  setPermission('denied')
  const stop = vi.fn()
  const getUserMedia = vi.fn()
    .mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'))
    .mockResolvedValueOnce({ getTracks: () => [{ stop }] })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  render(<MicrophonePermissionPage />)
  fireEvent.click(await screen.findByRole('button', { name: /retry permission/i }))
  expect(await screen.findByText(/microphone permission is blocked/i)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /open settings/i }))
  expect(tabsCreate).toHaveBeenCalledWith({ url: 'chrome://settings/content/microphone' })
  fireEvent.click(screen.getByRole('button', { name: /retry permission/i }))
  await waitFor(() => expect(screen.getByText(/microphone access allowed/i)).toBeVisible())
  expect(stop).toHaveBeenCalledOnce()
})
