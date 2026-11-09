import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'

const mocks = vi.hoisted(() => ({ start: vi.fn(), speak: vi.fn(), stop: vi.fn(), cancel: vi.fn() }))
vi.mock('./hooks/useRecorder', () => ({ RecordingCancelledError: class extends Error {}, useRecorder: () => ({ start: mocks.start, stop: mocks.stop, cancel: mocks.cancel, status: 'idle', elapsed: 0 }) }))
vi.mock('./services/microphonePermission', () => ({ requestMicrophonePermission: () => Promise.resolve('granted'), cancelMicrophonePermissionRequest: vi.fn() }))
vi.mock('./services/speech', () => ({ speakQuestion: mocks.speak, stopSpeaking: vi.fn() }))

const zeroShot = { example_count: 0, example_source: 'none', examples: 'zero_shot', reasoning: 'direct', techniques: [], execution: 'single_pass', max_iterations: 1, rationale: 'Clear request.', example_requirement: 'No reference examples required.', success_criteria: [] }
const fewShotCot = { ...zeroShot, example_count: 3, example_source: 'illustrative', examples: 'few_shot', reasoning: 'chain_of_thought', techniques: ['structured_output'], rationale: 'Offline sync rules need worked examples.', example_requirement: 'Show conflict cases.' }
const methodology = { name: 'Prototype first', description: 'Build a small working prototype', rationale: 'Validate the core goal', prompting: zeroShot }
const analysis = { goal: 'Build an event app', intended_output: 'Working app', context: '', domain: 'software', known_requirements: [], missing_requirements: [], constraints: [], ambiguity: [], risks: [], alternatives: [], methodology }
const question = { id: 'q1', question: 'Should it work offline?', relevance: 'Changes storage design', choices: ['Yes', 'No'], skippable: true }
const followUp = { id: 'devices', question: 'Which devices must work offline?', relevance: 'Sets the sync scope', choices: ['Phones only', 'Phones and laptops'], skippable: true }
const otherFollowUp = { id: 'hosting', question: 'Where will the server run?', relevance: 'Online-only hosting', choices: ['Cloud', 'On campus'], skippable: true }

type WireAnswer = { question_id: string; answer: string; skipped: boolean }
let generateBody: Record<string, unknown>
let analyzeBodies: { input: string; learned_feedback?: string[] }[]
let interviewBodies: { answers: WireAnswer[] }[]
let transcripts: string[]
const insert = vi.fn<(message: unknown) => Promise<{ ok: boolean; platform: string }>>()
const generateCalls = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/generate')).length

/** Interviewer double: the second question depends on the first answer. */
function nextQuestion(body: { answers: WireAnswer[] }) {
  const [first, second] = body.answers
  if (!first) return { done: false, question, methodology, reason: 'Storage decides architecture', asked: 0, limit: 5 }
  if (first.skipped) return { done: true, question: null, methodology, reason: 'Enough', asked: 1, limit: 5 }
  if (!second) return { done: false, question: /yes/i.test(first.answer) ? followUp : otherFollowUp, methodology, reason: 'Follow up', asked: 1, limit: 5 }
  return { done: true, question: null, methodology: { ...methodology, prompting: fewShotCot }, reason: 'Enough context', asked: 2, limit: 5 }
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals()
  interviewBodies = []
  analyzeBodies = []
  transcripts = ['Build an event app', 'option one', 'Phones and laptops please']
  mocks.start.mockImplementation(() => Promise.resolve(new Blob(['audio'], { type: 'audio/webm' })))
  // Simulate the browser finishing speech so hands-free listening starts.
  mocks.speak.mockImplementation((_text: string, _onError: () => void, onEnd?: () => void) => { if (onEnd) queueMicrotask(onEnd); return true })
  insert.mockReset().mockResolvedValue({ ok: true, platform: 'ChatGPT' })
  vi.stubGlobal('chrome', { runtime: { sendMessage: (message: { type: string }) => message.type === 'GET_INSERT_TARGET' ? Promise.resolve({ tabId: 1, url: 'https://chatgpt.com/', title: 'ChatGPT' }) : insert(message) } })
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null
    const result = url.endsWith('/analyze') ? (analyzeBodies.push(body), { analysis })
      : url.endsWith('/next-question') ? (interviewBodies.push(body), nextQuestion(body))
      : url.endsWith('/transcribe') ? { transcript: transcripts.shift() ?? 'extra' }
      : (generateBody = body, { prompt: 'Build an event app that works offline. Validate offline persistence.', assumptions: [] })
    return new Response(JSON.stringify(result), { status: 200 })
  }))
})

async function reachTextQuestions() {
  render(<App />)
  fireEvent.change(await screen.findByRole('textbox', { name: 'Rough prompt' }), { target: { value: 'Build an event app' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use approach' }))
}

async function reachVoiceQuestions() {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Speak' }))
  expect(await screen.findByRole('textbox', { name: 'Transcript' })).toHaveValue('Build an event app')
  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use approach' }))
}

test('text workflow asks adaptive multiple-choice questions, edits, inserts only after approval and starts again', async () => {
  await reachTextQuestions()
  fireEvent.click(await screen.findByRole('button', { name: /1\.\s*Yes/ }))
  expect(screen.getByRole('button', { name: /1\.\s*Yes/ })).toHaveAttribute('aria-pressed', 'true')
  // Text mode never speaks or opens the microphone on its own; the voice button stays available.
  expect(mocks.speak).not.toHaveBeenCalled()
  expect(mocks.start).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Answer by voice' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  // The follow-up is chosen from the "Yes" answer.
  expect(await screen.findByText(followUp.question)).toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: `Answer: ${followUp.question}` }), { target: { value: 'Tablets at the venue' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText('Ready to build your prompt')).toBeVisible()
  // The strategy adapted to the answers: few-shot with chain-of-thought.
  expect(screen.getByText('Few-shot · 3 illustrative examples')).toBeVisible()
  expect(screen.getByText('Chain-of-thought · step-by-step reasoning')).toBeVisible()
  expect(screen.getByText('Structured output')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Build prompt' }))
  const editor = await screen.findByRole('textbox', { name: 'Final prompt' })
  expect(interviewBodies.map((body) => body.answers.length)).toEqual([0, 1, 2])
  expect(generateBody.answers).toEqual([
    { question_id: 'q1', question: question.question, answer: 'Yes', skipped: false },
    { question_id: 'devices', question: followUp.question, answer: 'Tablets at the venue', skipped: false },
  ])
  expect((generateBody.methodology as typeof methodology).prompting).toMatchObject({ examples: 'few_shot', reasoning: 'chain_of_thought' })
  expect(generateBody.learned_feedback).toEqual([])
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

test('voice workflow reads questions and options aloud, listens without a button and carries answers into generation', async () => {
  await reachVoiceQuestions()
  await waitFor(() => expect(mocks.speak).toHaveBeenCalledWith('Question 1. Should it work offline? Option 1: Yes. Option 2: No. Say an option number, or describe your own answer.', expect.any(Function), expect.any(Function)))
  // Options are displayed and clickable, and no extra button is needed to answer by voice.
  expect(screen.getByRole('button', { name: /2\.\s*No/ })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Answer by voice' })).not.toBeInTheDocument()
  // After the question is read, the spoken "option one" is heard and mapped to option 1.
  await waitFor(() => expect(screen.getByRole('button', { name: /1\.\s*Yes/ })).toHaveAttribute('aria-pressed', 'true'))
  expect(screen.getByText(/Heard “option one”/)).toHaveTextContent('selected option 1')
  expect(mocks.start).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText(followUp.question)).toBeVisible()
  await waitFor(() => expect(screen.getByRole('button', { name: /2\.\s*Phones and laptops/ })).toHaveAttribute('aria-pressed', 'true'))
  expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining('Question 2. Which devices must work offline? Option 1: Phones only.'), expect.any(Function), expect.any(Function))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Build prompt' }))
  expect(await screen.findByRole('textbox', { name: 'Final prompt' })).toHaveValue('Build an event app that works offline. Validate offline persistence.')
  expect(generateBody.answers).toEqual([
    { question_id: 'q1', question: question.question, answer: 'Yes', skipped: false },
    { question_id: 'devices', question: followUp.question, answer: 'Phones and laptops', skipped: false },
  ])
  expect(insert).not.toHaveBeenCalled()
})

test('changing an earlier answer re-plans the following question', async () => {
  await reachTextQuestions()
  fireEvent.click(await screen.findByRole('button', { name: /1\.\s*Yes/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText(followUp.question)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  // Going forward with the same answer reuses the planned question without another request.
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
  expect(await screen.findByText(followUp.question)).toBeVisible()
  expect(interviewBodies).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  fireEvent.click(await screen.findByRole('button', { name: /2\.\s*No/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText(otherFollowUp.question)).toBeVisible()
  expect(screen.queryByText(followUp.question)).not.toBeInTheDocument()
  expect(interviewBodies).toHaveLength(3)
})

test('skipping a question sends it as skipped, never a stale answer', async () => {
  await reachVoiceQuestions()
  await waitFor(() => expect(screen.getByRole('button', { name: /1\.\s*Yes/ })).toHaveAttribute('aria-pressed', 'true'))
  fireEvent.click(screen.getByRole('button', { name: 'Skip question' }))
  expect(await screen.findByText('Ready to build your prompt')).toBeVisible()
  expect(interviewBodies[1].answers).toEqual([{ question_id: 'q1', question: question.question, answer: '', skipped: true }])
  fireEvent.click(screen.getByRole('button', { name: 'Build prompt' }))
  await screen.findByRole('textbox', { name: 'Final prompt' })
  expect(generateBody.answers).toEqual([{ question_id: 'q1', question: question.question, answer: '', skipped: true }])
})

test('regenerate asks what was wrong by voice, rewrites with that feedback and remembers it for the next prompt', async () => {
  transcripts = ['Build an event app', 'option one', 'It is too long, make it shorter and friendlier']
  await reachVoiceQuestions()
  await waitFor(() => expect(screen.getByRole('button', { name: /1\.\s*Yes/ })).toHaveAttribute('aria-pressed', 'true'))
  fireEvent.click(screen.getByRole('button', { name: 'Build prompt now' }))
  const editor = await screen.findByRole('textbox', { name: 'Final prompt' })
  fireEvent.change(editor, { target: { value: 'My manually edited prompt with offline storage.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
  // Voice mode asks the feedback question aloud and listens straight away.
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'What to change' })).toHaveValue('It is too long, make it shorter and friendlier'))
  expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining('What should change in this prompt?'), expect.any(Function), expect.any(Function))
  expect(screen.getByRole('button', { name: 'Too long' })).toHaveAttribute('aria-pressed', 'true')
  const before = generateCalls()
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate with feedback' }))
  await waitFor(() => expect(generateCalls()).toBe(before + 1))
  await screen.findByRole('textbox', { name: 'Final prompt' })
  expect(generateBody.previous_prompt).toBe('My manually edited prompt with offline storage.')
  expect(generateBody.revision_request).toContain('Problems they flagged: Too long.')
  expect(generateBody.revision_request).toContain('make it shorter and friendlier')
  expect(generateBody.learned_feedback).toEqual(expect.arrayContaining([expect.stringContaining('too long')]))
  expect(await screen.findByText('Learning from 1 earlier feedback note.')).toBeVisible()
  // The lesson carries into the next prompt.
  fireEvent.click(screen.getByRole('button', { name: 'New prompt / clear saved work' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Rough prompt' }), { target: { value: 'Plan a study timetable' } })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('button', { name: 'Use approach' })
  expect(analyzeBodies.at(-1)?.learned_feedback).toEqual(expect.arrayContaining([expect.stringContaining('too long'), expect.stringContaining('friendlier')]))
})

test('text-mode regenerate requires feedback and can switch the prompting technique', async () => {
  await reachTextQuestions()
  fireEvent.click(await screen.findByRole('button', { name: 'Build prompt now' }))
  await screen.findByRole('textbox', { name: 'Final prompt' })
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
  expect(mocks.speak).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Regenerate with feedback' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Wrong prompting technique' }))
  fireEvent.click(screen.getByRole('button', { name: 'Few-shot' }))
  fireEvent.click(screen.getByRole('button', { name: 'Chain-of-thought' }))
  const before = generateCalls()
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate with feedback' }))
  await waitFor(() => expect(generateCalls()).toBe(before + 1))
  expect(generateBody.revision_request).toContain('different prompting technique: few-shot (3 examples) + chain-of-thought')
  expect((generateBody.methodology as typeof methodology).prompting).toMatchObject({ examples: 'few_shot', example_count: 3, example_source: 'illustrative', reasoning: 'chain_of_thought' })
  expect(generateBody.learned_feedback).toEqual([expect.stringContaining('Avoid zero-shot for software tasks')])
})

test('generation failure retries generation without asking for the original input again', async () => {
  const normalFetch = vi.mocked(fetch).getMockImplementation()!
  let failed = false
  vi.mocked(fetch).mockImplementation(async (...args) => {
    if (String(args[0]).endsWith('/generate') && !failed) { failed = true; return new Response(JSON.stringify({ error: { code: 'provider_rate_limit', message: 'Try again soon' } }), { status: 429 }) }
    return normalFetch(...args)
  })
  await reachTextQuestions()
  fireEvent.click(await screen.findByRole('button', { name: 'Build prompt now' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again soon')
  fireEvent.click(screen.getByRole('button', { name: 'Retry last step' }))
  expect(await screen.findByRole('textbox', { name: 'Final prompt' })).toBeVisible()
  expect(screen.queryByRole('textbox', { name: 'Rough prompt' })).not.toBeInTheDocument()
})

test('a failed next-question request keeps answers and lets the user retry or build', async () => {
  const normalFetch = vi.mocked(fetch).getMockImplementation()!
  let failures = 1
  vi.mocked(fetch).mockImplementation(async (...args) => {
    const body = JSON.parse(String((args[1] as RequestInit).body ?? 'null'))
    if (String(args[0]).endsWith('/next-question') && body?.answers?.length === 1 && failures-- > 0) return new Response(JSON.stringify({ error: { code: 'provider_unavailable', message: 'Provider is down.' } }), { status: 502 })
    return normalFetch(...args)
  })
  await reachTextQuestions()
  fireEvent.click(await screen.findByRole('button', { name: /1\.\s*Yes/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Provider is down.')
  expect(screen.getByText('Yes')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Ask another question' }))
  expect(await screen.findByText(followUp.question)).toBeVisible()
})

test('no-question path generates directly', async () => {
  const normalFetch = vi.mocked(fetch).getMockImplementation()!
  vi.mocked(fetch).mockImplementation(async (...args) => String(args[0]).endsWith('/next-question') ? new Response(JSON.stringify({ done: true, question: null, methodology, reason: 'Clear', asked: 0, limit: 5 }), { status: 200 }) : normalFetch(...args))
  await reachTextQuestions()
  expect(await screen.findByRole('textbox', { name: 'Final prompt' })).toBeVisible()
  expect(generateBody.answers).toEqual([])
})

test('voice mode can deliberately switch to text without losing the question', async () => {
  await reachVoiceQuestions()
  fireEvent.click(await screen.findByRole('button', { name: 'Switch to text' }))
  expect(await screen.findByRole('textbox', { name: `Answer: ${question.question}` })).toBeVisible()
  // Text mode keeps the explicit voice button; voice mode does not need it.
  expect(screen.getByRole('button', { name: 'Answer by voice' })).toBeVisible()
  expect(screen.queryByRole('button', { name: /Repeat question/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Switch to voice' })).toBeVisible()
})
