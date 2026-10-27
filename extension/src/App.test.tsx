import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'

beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals() })

test('renders typed and voice entry points', () => {
  render(<App />)
  expect(screen.getByRole('textbox', { name: /rough prompt/i })).toBeVisible()
  expect(screen.getByRole('button', { name: /speak/i })).toBeVisible()
})

test('typed input advances to methodology review', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    analysis: {
      goal: 'Create a launch plan', context: '', intended_output: 'Plan', known_requirements: [], missing_requirements: [], constraints: [], domain: 'marketing', ambiguity: [], risks: [],
      methodology: { name: 'Phased launch', description: 'Launch in stages', rationale: 'Reduces risk' }, alternatives: [],
    }, usage: {}, model: 'mock/model',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  render(<App />)
  fireEvent.change(screen.getByRole('textbox', { name: /rough prompt/i }), { target: { value: 'Create a launch plan' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  await waitFor(() => expect(screen.getByText(/choose how to tackle it/i)).toBeVisible())
  expect(screen.getByRole('button', { name: /phased launch/i })).toHaveAttribute('aria-pressed', 'true')
})
