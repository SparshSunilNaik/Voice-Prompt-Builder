import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { PromptReview, QuestionsView } from './WorkflowViews'

test('follow-up supports custom answers and explicit skipping', () => {
  const answer = vi.fn()
  const skip = vi.fn()
  render(<QuestionsView questions={[{ id: 'audience', question: 'Who is the audience?', relevance: 'Changes tone', choices: ['Experts'], skippable: true }]} answers={{ audience: { questionId: 'audience', question: 'Who is the audience?', answer: '', skipped: false } }} onAnswer={answer} onSkip={skip} onBack={() => undefined} onGenerate={() => undefined} />)
  fireEvent.change(screen.getByRole('textbox', { name: /answer: who/i }), { target: { value: 'New users' } })
  fireEvent.click(screen.getByRole('button', { name: /skip this question/i }))
  expect(answer).toHaveBeenCalledWith('audience', 'New users')
  expect(skip).toHaveBeenCalledWith('audience')
})

test('final prompt remains editable and insertion requires its dedicated approval control', () => {
  const change = vi.fn()
  const insert = vi.fn()
  const copy = vi.fn()
  render(<PromptReview prompt="Initial prompt" assumptions={[]} onChange={change} onBack={() => undefined} onRegenerate={() => undefined} onCopy={copy} onInsert={insert} />)
  fireEvent.change(screen.getByRole('textbox', { name: /final prompt/i }), { target: { value: 'Edited prompt' } })
  fireEvent.click(screen.getByRole('button', { name: /approve & insert/i }))
  expect(change).toHaveBeenCalledWith('Edited prompt')
  expect(insert).toHaveBeenCalledOnce()
  expect(copy).not.toHaveBeenCalled()
})
