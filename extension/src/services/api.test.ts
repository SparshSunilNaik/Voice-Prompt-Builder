import { beforeEach, expect, test, vi } from 'vitest'
import type { IntentAnalysis, Methodology } from '../contracts'
import { api, ApiError } from './api'

const methodology: Methodology = { name: 'Workflow', description: 'Steps', rationale: 'Reliable' }
const analysis: IntentAnalysis = { goal: 'Build', context: '', intended_output: 'Plan', known_requirements: [], missing_requirements: [], constraints: [], domain: 'software', ambiguity: [], risks: [], methodology, alternatives: [] }

beforeEach(() => vi.unstubAllGlobals())

test('sends extension marker and serializes workflow answers', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ prompt: 'Final prompt content', assumptions: [], usage: {}, model: 'mock' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  await api.generate('Build it', analysis, methodology, [{ questionId: 'scope', question: 'Which scope?', answer: '', skipped: true }])
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(init.headers).toMatchObject({ 'X-Extension-Request': '1' })
  expect(JSON.parse(init.body as string).answers).toEqual([{ question_id: 'scope', question: 'Which scope?', answer: '', skipped: true }])
})

test('reports backend connectivity failures clearly', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
  const error = await api.analyze('Build it').catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).code).toBe('backend_unreachable')
})
