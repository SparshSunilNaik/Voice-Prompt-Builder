import type { AnalyzeResponse, GenerateResponse, IntentAnalysis, Methodology, RefineResponse, ReviewResponse } from '../contracts'
import type { FollowUpAnswer } from '../state/workflow'

const API_URL = 'http://127.0.0.1:8000'
const activeRequests = new Set<AbortController>()
export async function getBackendToken(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) return (await chrome.storage.session.get('backendToken')).backendToken as string || ''
  return sessionStorage.getItem('backendToken') || ''
}
export async function setBackendToken(token: string) {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) await chrome.storage.session.set({ backendToken: token.trim() })
  else sessionStorage.setItem('backendToken', token.trim())
}


export class ApiError extends Error {
  constructor(message: string, readonly code = 'request_failed') { super(message) }
}

function validReview(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const report = value as Record<string, unknown>
  const texts = (items: unknown) => Array.isArray(items) && items.every((item) => typeof item === 'string')
  const strategy = report.recommended_strategy as Record<string, unknown> | undefined
  return ['ready', 'needs_revision', 'needs_input'].includes(String(report.verdict)) && texts(report.strengths) && texts(report.missing_inputs) && (report.review_notes === undefined || texts(report.review_notes)) && Array.isArray(report.issues) && report.issues.every((item: Record<string, unknown>) => item && ['high', 'medium', 'low'].includes(String(item.severity)) && typeof item.issue === 'string' && typeof item.improvement === 'string' && (item.evidence === undefined || typeof item.evidence === 'string')) && !!strategy && ['zero_shot', 'one_shot', 'few_shot'].includes(String(strategy.examples)) && ['direct', 'decompose_and_verify'].includes(String(strategy.reasoning)) && ['single_pass', 'bounded_iteration'].includes(String(strategy.execution)) && Number.isInteger(strategy.max_iterations) && Number(strategy.max_iterations) >= 1 && Number(strategy.max_iterations) <= 5 && typeof strategy.rationale === 'string' && typeof strategy.example_requirement === 'string' && texts(strategy.success_criteria)
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController()
  activeRequests.add(controller)
  const timer = window.setTimeout(() => controller.abort('deadline'), 100_000)
  try {
    const token = await getBackendToken()
    const response = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal, headers: { 'X-Extension-Request': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const failure = body as { error?: { message?: string; code?: string } } | null
      throw new ApiError(failure?.error?.message || (response.status === 422 ? 'Some input is invalid or too long. Review your text and try again.' : `Request failed (${response.status})`), failure?.error?.code)
    }
    if (!body || typeof body !== 'object') throw new ApiError('The backend returned an invalid response.', 'invalid_response')
    const value = body as Record<string, unknown>
    const valid = path === '/api/transcribe' ? typeof value.transcript === 'string' && !!value.transcript.trim()
      : path === '/api/generate' ? typeof value.prompt === 'string' && value.prompt.length >= 10 && Array.isArray(value.assumptions) && value.assumptions.every((x) => typeof x === 'string')
      : path === '/api/review' ? validReview(value.report)
      : path === '/api/refine' ? Array.isArray(value.questions) && value.questions.length <= 3 && value.questions.every((q: Record<string, unknown>) => q && typeof q.id === 'string' && typeof q.question === 'string' && typeof q.relevance === 'string' && Array.isArray(q.choices) && q.choices.every((c) => typeof c === 'string')) && new Set(value.questions.map((q: { id: string }) => q.id)).size === value.questions.length
      : !!value.analysis && typeof value.analysis === 'object' && typeof (value.analysis as IntentAnalysis).goal === 'string' && Array.isArray((value.analysis as IntentAnalysis).alternatives) && !!(value.analysis as IntentAnalysis).methodology
    if (!valid) throw new ApiError('The backend response was incomplete. Retry this step.', 'invalid_response')
    return body as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (controller.signal.aborted) throw new ApiError(controller.signal.reason === 'deadline' ? 'This request took too long. Retry this step.' : 'Request cancelled.', 'request_cancelled')
    throw new ApiError('Cannot reach the local backend. Start it and try again.', 'backend_unreachable')
  } finally { window.clearTimeout(timer); activeRequests.delete(controller) }
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  cancel() { activeRequests.forEach((controller) => controller.abort()) },
  async transcribe(blob: Blob): Promise<string> {
    const form = new FormData()
    const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'
    form.append('audio', blob, `recording.${extension}`)
    const result = await request<{ transcript: string }>('/api/transcribe', { method: 'POST', body: form })
    return result.transcript
  },
  review(input: string, analysis: IntentAnalysis, methodology: Methodology, answers: FollowUpAnswer[], prompt: string, custom_instructions = '') {
    return request<ReviewResponse>('/api/review', json({ input, analysis, methodology, answers: answers.map(({ questionId, question, answer, skipped }) => ({ question_id: questionId, question, answer, skipped: skipped || !answer.trim() })), prompt, custom_instructions }))
  },
  analyze(input: string) { return request<AnalyzeResponse>('/api/analyze', json({ input })) },
  refine(input: string, analysis: IntentAnalysis, methodology: Methodology, custom_instructions = '') {
    return request<RefineResponse>('/api/refine', json({ input, analysis, methodology, custom_instructions }))
  },
  generate(input: string, analysis: IntentAnalysis, methodology: Methodology, answers: FollowUpAnswer[], custom_instructions = '', previous_prompt = '', revision_request = '') {
    return request<GenerateResponse>('/api/generate', json({ input, analysis, methodology, answers: answers.map(({ questionId, question, answer, skipped }) => ({ question_id: questionId, question, answer, skipped: skipped || !answer.trim() })), custom_instructions, previous_prompt, revision_request }))
  },
}
