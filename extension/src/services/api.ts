import type { AnalyzeResponse, GenerateResponse, IntentAnalysis, Methodology, RefineResponse } from '../contracts'
import type { FollowUpAnswer } from '../state/workflow'

const API_URL = 'http://127.0.0.1:8000'

export class ApiError extends Error {
  constructor(message: string, readonly code = 'request_failed') { super(message) }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'X-Extension-Request': '1', ...init.headers } })
  } catch {
    throw new ApiError('Cannot reach the local backend. Start it and try again.', 'backend_unreachable')
  }
  const body = await response.json().catch(() => ({})) as { error?: { message?: string; code?: string } }
  if (!response.ok) throw new ApiError(body.error?.message || `Request failed (${response.status})`, body.error?.code)
  return body as T
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  async transcribe(blob: Blob): Promise<string> {
    const form = new FormData()
    const extension = blob.type.includes('ogg') ? 'ogg' : 'webm'
    form.append('audio', blob, `recording.${extension}`)
    const result = await request<{ transcript: string }>('/api/transcribe', { method: 'POST', body: form })
    return result.transcript
  },
  analyze(input: string) { return request<AnalyzeResponse>('/api/analyze', json({ input })) },
  refine(input: string, analysis: IntentAnalysis, methodology: Methodology, custom_instructions = '') {
    return request<RefineResponse>('/api/refine', json({ input, analysis, methodology, custom_instructions }))
  },
  generate(input: string, analysis: IntentAnalysis, methodology: Methodology, answers: FollowUpAnswer[], custom_instructions = '', previous_prompt = '', revision_request = '') {
    return request<GenerateResponse>('/api/generate', json({ input, analysis, methodology, answers: answers.map(({ questionId, answer, skipped }) => ({ question_id: questionId, answer, skipped })), custom_instructions, previous_prompt, revision_request }))
  },
}
