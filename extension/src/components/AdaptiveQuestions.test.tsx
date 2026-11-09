import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { FollowUpQuestion, PromptingStrategy } from '../contracts'
import { AdaptiveQuestions } from './AdaptiveQuestions'
import { StrategySummary } from './StrategySummary'

const mocks = vi.hoisted(() => ({ speak: vi.fn(), start: vi.fn(), cancel: vi.fn(), transcribe: vi.fn() }))
vi.mock('../services/speech', () => ({ speakQuestion: mocks.speak, stopSpeaking: vi.fn() }))
vi.mock('../services/microphonePermission', () => ({ requestMicrophonePermission: () => Promise.resolve('granted'), cancelMicrophonePermissionRequest: vi.fn() }))
vi.mock('../hooks/useRecorder', () => ({ RecordingCancelledError: class extends Error {}, useRecorder: () => ({ start: mocks.start, stop: vi.fn(), cancel: mocks.cancel, status: 'idle', elapsed: 0 }) }))
vi.mock('../services/api', () => ({ api: { transcribe: mocks.transcribe } }))

const question: FollowUpQuestion = { id: 'audience', question: 'Who is the audience?', relevance: 'Changes tone', choices: ['Students', 'Teachers', 'Parents'], skippable: true }
const base = { questions: [question], index: 0, asking: false, error: '', done: false, limit: 5, onNext: vi.fn(), onPrevious: vi.fn(), onBuild: vi.fn(), onMode: vi.fn() }
const empty = { audience: { questionId: 'audience', question: question.question, answer: '', skipped: false } }

beforeEach(() => { vi.clearAllMocks(); mocks.speak.mockReturnValue(true); mocks.start.mockResolvedValue(new Blob(['a'])) })

test('text mode shows selectable options, a custom answer and explicit skipping without speaking', () => {
  const answer = vi.fn(); const skip = vi.fn()
  render(<AdaptiveQuestions {...base} voice={false} answers={empty} onAnswer={answer} onSkip={skip} />)
  fireEvent.click(screen.getByRole('button', { name: /2\.\s*Teachers/ }))
  fireEvent.change(screen.getByRole('textbox', { name: /answer: who/i }), { target: { value: 'New users' } })
  fireEvent.click(screen.getByRole('button', { name: /skip question/i }))
  expect(answer).toHaveBeenNthCalledWith(1, 'audience', 'Teachers')
  expect(answer).toHaveBeenNthCalledWith(2, 'audience', 'New users')
  expect(skip).toHaveBeenCalledWith('audience')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(mocks.speak).not.toHaveBeenCalled()
})

const finishSpeaking = (_text: string, _onError: () => void, onEnd?: () => void) => { if (onEnd) queueMicrotask(onEnd); return true }

test('voice mode reads the options aloud, then listens on its own and keeps an unmatched answer as custom', async () => {
  const answer = vi.fn()
  mocks.speak.mockImplementation(finishSpeaking)
  mocks.transcribe.mockResolvedValue('mostly school administrators')
  render(<AdaptiveQuestions {...base} voice answers={empty} onAnswer={answer} onSkip={vi.fn()} />)
  expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining('Option 3: Parents.'), expect.any(Function), expect.any(Function))
  expect(screen.queryByRole('button', { name: 'Answer by voice' })).not.toBeInTheDocument()
  await waitFor(() => expect(answer).toHaveBeenCalledWith('audience', 'mostly school administrators'))
  expect(mocks.start).toHaveBeenCalledWith({ autoStop: true })
  expect(screen.getByText(/Heard/)).toHaveTextContent('kept as your own answer')
})

test('voice mode does not listen again for an already answered question until asked to repeat', async () => {
  mocks.speak.mockImplementation(finishSpeaking)
  mocks.transcribe.mockResolvedValue('option 2')
  const answer = vi.fn()
  const answered = { audience: { ...empty.audience, answer: 'Students' } }
  render(<AdaptiveQuestions {...base} voice answers={answered} onAnswer={answer} onSkip={vi.fn()} />)
  await waitFor(() => expect(mocks.speak).toHaveBeenCalledOnce())
  await Promise.resolve()
  expect(mocks.start).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Repeat question/ }))
  await waitFor(() => expect(answer).toHaveBeenCalledWith('audience', 'Teachers'))
})

test('tapping an option while listening stops the microphone and keeps the tapped answer', async () => {
  mocks.speak.mockImplementation(finishSpeaking)
  mocks.start.mockReturnValue(new Promise(() => undefined))
  const answer = vi.fn()
  render(<AdaptiveQuestions {...base} voice answers={empty} onAnswer={answer} onSkip={vi.fn()} />)
  await waitFor(() => expect(mocks.start).toHaveBeenCalled())
  expect(screen.getByRole('button', { name: 'Switch to text' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /3\.\s*Parents/ }))
  expect(answer).toHaveBeenCalledWith('audience', 'Parents')
  expect(mocks.cancel).toHaveBeenCalled()
})

test('reports unavailable speech without blocking clickable answers', async () => {
  mocks.speak.mockImplementation((_text: string, onError: () => void) => { queueMicrotask(onError); return false })
  render(<AdaptiveQuestions {...base} voice answers={empty} onAnswer={vi.fn()} onSkip={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/speech playback is unavailable/i)
  expect(screen.getByRole('button', { name: /1\.\s*Students/ })).toBeEnabled()
})

test('summary shows answers and the adapted techniques, and offers another question until done', () => {
  const build = vi.fn(); const next = vi.fn()
  const strategy: PromptingStrategy = { example_count: 1, example_source: 'user_supplied', examples: 'one_shot', reasoning: 'chain_of_thought', techniques: ['role_prompting', 'self_critique'], execution: 'single_pass', max_iterations: 1, rationale: 'User has one example.', example_requirement: 'One approved lesson plan.', success_criteria: [] }
  const answered = { audience: { ...empty.audience, answer: 'Students' } }
  const { rerender } = render(<AdaptiveQuestions {...base} index={1} voice={false} answers={answered} strategy={strategy} onAnswer={vi.fn()} onSkip={vi.fn()} onBuild={build} onNext={next} />)
  expect(screen.getByText('Students')).toBeVisible()
  expect(screen.getByText('One-shot · 1 of your examples')).toBeVisible()
  expect(screen.getByText('Chain-of-thought · step-by-step reasoning')).toBeVisible()
  expect(screen.getByText('Role prompting')).toBeVisible()
  expect(screen.getByText(/Examples to supply/)).toHaveTextContent('One approved lesson plan.')
  fireEvent.click(screen.getByRole('button', { name: 'Ask another question' }))
  fireEvent.click(screen.getByRole('button', { name: 'Build prompt' }))
  expect(next).toHaveBeenCalledOnce(); expect(build).toHaveBeenCalledOnce()
  rerender(<AdaptiveQuestions {...base} index={1} done voice={false} answers={answered} strategy={strategy} onAnswer={vi.fn()} onSkip={vi.fn()} />)
  expect(screen.getByText('Ready to build your prompt')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Ask another question' })).not.toBeInTheDocument()
})

test('strategy summary stays compatible with older saved strategies', () => {
  render(<StrategySummary strategy={{ examples: 'zero_shot', reasoning: 'decompose_and_verify', execution: 'single_pass', max_iterations: 1, rationale: 'Older', example_requirement: '', success_criteria: [] }} />)
  expect(screen.getByText('Zero-shot · no examples')).toBeVisible()
  expect(screen.getByText('Decompose & verify')).toBeVisible()
})
