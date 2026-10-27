import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { useWorkflow } from './useWorkflow'

beforeEach(() => localStorage.clear())

test('persists non-audio workflow state and restores it', async () => {
  const first = renderHook(() => useWorkflow())
  await waitFor(() => expect(first.result.current[2]).toBe(true))
  act(() => first.result.current[1]({ type: 'SET_INPUT', value: 'Persist this idea' }))
  await waitFor(() => expect(localStorage.getItem('voicePromptWorkflow')).toContain('Persist this idea'))
  first.unmount()
  const second = renderHook(() => useWorkflow())
  await waitFor(() => expect(second.result.current[0].roughInput).toBe('Persist this idea'))
  expect(localStorage.getItem('voicePromptWorkflow')).not.toContain('audio')
})
