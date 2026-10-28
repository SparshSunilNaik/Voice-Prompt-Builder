import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { restoreWorkflow, useWorkflow } from './useWorkflow'
import { initialWorkflow } from '../state/workflow'

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

test('recovers interrupted generation, preserves voice mode, rejects corrupt and expired saves', () => {
  const saved = { ...initialWorkflow, inputMode: 'voice', roughInput: 'Build an event app', finalPrompt: 'Keep this reviewed prompt', stage: 'generating' }
  const restored = restoreWorkflow({ version: 2, savedAt: Date.now(), state: saved })
  expect(restored.stage).toBe('review')
  expect(restored.inputMode).toBe('voice')
  expect(restored.error).toMatch(/interrupted/)
  expect(restoreWorkflow({ version: 2, savedAt: Date.now() - 25 * 60 * 60 * 1000, state: saved })).toEqual(initialWorkflow)
  for (const invalid of [null, {}, { version: 2, savedAt: Date.now(), state: null }]) expect(restoreWorkflow(invalid)).toEqual(initialWorkflow)
})
