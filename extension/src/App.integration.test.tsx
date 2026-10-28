import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'

const mocks = vi.hoisted(() => ({ start: vi.fn(), speak: vi.fn(), stop: vi.fn(), cancel: vi.fn() }))
vi.mock('./hooks/useRecorder', () => ({ RecordingCancelledError: class extends Error {}, useRecorder: () => ({ start: mocks.start, stop: mocks.stop, cancel: mocks.cancel, status: 'idle', elapsed: 0 }) }))
vi.mock('./services/microphonePermission', () => ({ requestMicrophonePermission: () => Promise.resolve('granted'), cancelMicrophonePermissionRequest: vi.fn() }))
vi.mock('./services/speech', () => ({ speakQuestion: mocks.speak, stopSpeaking: vi.fn() }))
const methodology = { name: 'Prototype first', description: 'Build a small working prototype', rationale: 'Validate the core goal' }
const analysis = { goal: 'Build an event app', intended_output: 'Working app', context: '', domain: 'software', known_requirements: [], missing_requirements: [], constraints: [], ambiguity: [], risks: [], alternatives: [], methodology }
const question = { id: 'q1', question: 'Should it work offline?', relevance: 'Changes storage design', choices: ['Yes', 'No'], skippable: true }
let generateBody: Record<string, unknown>
let transcriptions: number
const insert = vi.fn<(message: unknown) => Promise<{ ok: boolean; platform: string }>>()

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals()
  transcriptions = 0
  mocks.start.mockImplementation(() => Promise.resolve(new Blob(['audio'], { type: 'audio/webm' })))
  mocks.speak.mockReturnValue(true)
  insert.mockReset().mockResolvedValue({ ok: true, platform: 'ChatGPT' })
  vi.stubGlobal('chrome', { runtime: { sendMessage: (message: { type: string }) => message.type === 'GET_INSERT_TARGET' ? Promise.resolve({ tabId: 1, url: 'https://chatgpt.com/', title: 'ChatGPT' }) : insert(message) } })
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const result = url.endsWith('/analyze') ? { analysis }
      : url.endsWith('/refine') ? { questions: [question] }
      : url.endsWith('/transcribe') ? { transcript: ++transcriptions === 1 ? 'Build an event app' : 'Yes, it must work offline' }
      : (generateBody = JSON.parse(init.body as string), { prompt: 'Build an event app that works offline. Validate offline persistence.', assumptions: [] })
    return new Response(JSON.stringify(result), { status: 200 })
  }))
})

test('text workflow keeps clarification in text, preserves question context, edits, inserts only after approval and starts again', async () => {
  render(<App />)
  fireEvent.change(await screen.findByRole('textbox', { name: 'Rough prompt' }), { target: { value: 'Build an event app' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use approach' }))
  fireEvent.change(await screen.findByRole('textbox', { name: `Answer: ${question.question}` }), { target: { value: 'Yes' } })
  expect(mocks.speak).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Build prompt' }))
  const editor = await screen.findByRole('textbox', { name: 'Final prompt' })
  expect(generateBody.answers).toEqual([{ question_id: 'q1', question: question.question, answer: 'Yes', skipped: false }])
  expect(insert).not.toHaveBeenCalled()
  fireEvent.change(editor, { target: { value: 'My reviewed offline event app prompt.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('My reviewed offline event app prompt.'))
  fireEvent.click(screen.getByRole('button', { name: 'Approve & insert' }))
  expect(await screen.findByText('Prompt inserted')).toBeVisible()
  expect(insert).toHaveBeenCalledWith({ type: 'INSERT_PROMPT', approved: true, prompt: 'My reviewed offline event app prompt.', targetTabId: 1, targetUrl: 'https://chatgpt.com/' })
  fireEvent.click(screen.getByRole('button', { name: /^New prompt$/ }))
  expect(await screen.findByRole('textbox', { name: 'Rough prompt' })).toHaveValue('')
})

test('voice workflow speaks clarification, transcribes spoken answers and carries their meaning through generation', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Speak' }))
  expect(await screen.findByRole('textbox', { name: 'Transcript' })).toHaveValue('Build an event app')
  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use approach' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Record answer' }))
  expect(await screen.findByRole('textbox', { name: 'Spoken answer transcript' })).toHaveValue('Yes, it must work offline')
  expect(mocks.speak).toHaveBeenCalledWith(`Question 1. ${question.question}`, expect.any(Function))
  fireEvent.click(screen.getByRole('button', { name: /^Review answers$/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Build prompt' }))
  expect(await screen.findByRole('textbox', { name: 'Final prompt' })).toHaveValue('Build an event app that works offline. Validate offline persistence.')
  expect(generateBody.answers).toEqual([{ question_id: 'q1', question: question.question, answer: 'Yes, it must work offline', skipped: false }])
  expect(transcriptions).toBe(2)
  expect(insert).not.toHaveBeenCalled()
})

async function reachTextQuestions() {
  render(<App />)
  fireEvent.change(await screen.findByRole('textbox', { name: 'Rough prompt' }), { target: { value: 'Build an event app' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use approach' }))
}

test('skips clarification explicitly and regenerates using the edited prompt and requested revision', async () => {
  await reachTextQuestions()
  fireEvent.click(await screen.findByRole('button', { name: 'Skip this question' }))
  fireEvent.click(screen.getByRole('button', { name: 'Build prompt' }))
  const editor = await screen.findByRole('textbox', { name: 'Final prompt' })
  expect(generateBody.answers).toEqual([{ question_id: 'q1', question: question.question, answer: '', skipped: true }])
  fireEvent.change(editor, { target: { value: 'My manually edited prompt with offline storage.' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Revision instructions' }), { target: { value: 'Keep my edits and make it shorter.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
  await screen.findByRole('textbox', { name: 'Final prompt' })
  expect(generateBody.previous_prompt).toBe('My manually edited prompt with offline storage.')
  expect(generateBody.revision_request).toBe('Keep my edits and make it shorter.')
})

test('generation failure retries generation without asking for the original input again', async () => {
  const normalFetch = vi.mocked(fetch).getMockImplementation()!
  let failed = false
  vi.mocked(fetch).mockImplementation(async (...args) => {
    if (String(args[0]).endsWith('/generate') && !failed) { failed = true; return new Response(JSON.stringify({ error: { code: 'provider_rate_limit', message: 'Try again soon' } }), { status: 429 }) }
    return normalFetch(...args)
  })
  await reachTextQuestions()
  fireEvent.click(await screen.findByRole('button', { name: 'Build prompt' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again soon')
  fireEvent.click(screen.getByRole('button', { name: 'Retry last step' }))
  expect(await screen.findByRole('textbox', { name: 'Final prompt' })).toBeVisible()
  expect(screen.queryByRole('textbox', { name: 'Rough prompt' })).not.toBeInTheDocument()
})

test('no-question path generates directly', async () => {
  const normalFetch = vi.mocked(fetch).getMockImplementation()!
  vi.mocked(fetch).mockImplementation(async (...args) => String(args[0]).endsWith('/refine') ? new Response(JSON.stringify({ questions: [] }), { status: 200 }) : normalFetch(...args))
  await reachTextQuestions()
  expect(await screen.findByRole('textbox', { name: 'Final prompt' })).toBeVisible()
  expect(generateBody.answers).toEqual([])
})

test('voice mode can deliberately switch to text without losing the question', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Speak' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Analyze' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use approach' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Switch to text' }))
  expect(await screen.findByRole('textbox', { name: `Answer: ${question.question}` })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Record answer' })).not.toBeInTheDocument()
})

test('skipping the last voice answer does not send a stale previous answer', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Speak' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Analyze' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use approach' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Record answer' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Spoken answer transcript' })).toHaveValue('Yes, it must work offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Skip question' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Build prompt' }))
  await screen.findByRole('textbox', { name: 'Final prompt' })
  expect(generateBody.answers).toEqual([{ question_id: 'q1', question: question.question, answer: '', skipped: true }])
})
