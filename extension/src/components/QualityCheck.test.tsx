import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { QualityCheck } from './QualityCheck'
import type { PromptQualityReview } from '../contracts'

const report: PromptQualityReview = {
  verdict: 'needs_revision', strengths: ['Clear audience'], missing_inputs: [],
  issues: [{ severity: 'medium', issue: 'No deliverable format', improvement: 'Specify the plan sections and acceptance checks.' }],
  recommended_strategy: { examples: 'zero_shot', reasoning: 'decompose_and_verify', execution: 'single_pass', max_iterations: 3, rationale: 'Planning needs structure, not autonomous execution.', example_requirement: 'No examples needed.', success_criteria: ['Requirements remain consistent'] },
}

test('reviews explicitly and exposes a combination of strategies without claiming execution', async () => {
  const review = vi.fn().mockResolvedValue(report)
  const revise = vi.fn()
  render(<QualityCheck prompt="Create a website development plan" review={review} onRevision={revise} />)
  expect(review).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Check quality & strategy' }))
  expect(await screen.findByText('Review suggests revisions')).toBeVisible()
  expect(screen.getByText(/Zero-shot · no examples/)).toBeVisible()
  expect(screen.getByText('Single response')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Use suggestions as revision instructions' }))
  expect(revise).toHaveBeenCalledWith(expect.stringContaining('Specify the plan sections'))
})

test('a late quality result cannot validate a prompt edited during review', async () => {
  let resolve!: (report: PromptQualityReview) => void
  const review = vi.fn(() => new Promise<PromptQualityReview>((done) => { resolve = done }))
  const { rerender } = render(<QualityCheck prompt="Original website plan" review={review} onRevision={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Check quality & strategy' }))
  rerender(<QualityCheck prompt="Changed website plan" review={review} onRevision={vi.fn()} />)
  resolve(report)
  await waitFor(() => expect(screen.getByText(/prompt has changed/i)).toBeVisible())
  expect(screen.queryByText('Review suggests revisions')).not.toBeInTheDocument()
})

test('review errors preserve the candidate and offer another review', async () => {
  render(<QualityCheck prompt="Create a website plan" review={vi.fn().mockRejectedValue(new Error('Review unavailable'))} onRevision={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Check quality & strategy' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Review unavailable')
  expect(screen.getByRole('button', { name: 'Check quality & strategy' })).toBeEnabled()
})
