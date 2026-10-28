import { useEffect, useReducer, useRef, useState } from 'react'
import { initialWorkflow, workflowReducer, type WorkflowState } from '../state/workflow'
import type { IntentAnalysis, Methodology } from '../contracts'

const KEY = 'voicePromptWorkflow'
const DAY = 24 * 60 * 60 * 1000
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 40 && value.every((item) => typeof item === 'string' && item.length <= 5000)
const method = (value: unknown): value is Methodology => !!value && typeof value === 'object' && ['name', 'description', 'rationale'].every((key) => typeof (value as Record<string, unknown>)[key] === 'string')
function analysis(value: unknown): value is IntentAnalysis {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return ['goal', 'context', 'intended_output', 'domain'].every((key) => typeof item[key] === 'string') && ['known_requirements', 'missing_requirements', 'constraints', 'ambiguity', 'risks'].every((key) => strings(item[key])) && method(item.methodology) && Array.isArray(item.alternatives) && item.alternatives.every(method)
}

export function restoreWorkflow(saved: unknown): WorkflowState {
  if (!saved || typeof saved !== 'object') return initialWorkflow
  const envelope = saved as { version?: number; savedAt?: number; state?: unknown }
  if (envelope.version === undefined && 'roughInput' in envelope) return restoreWorkflow({ version: 2, savedAt: Date.now(), state: saved })
  if (envelope.version !== 2 || !envelope.savedAt || Date.now() - envelope.savedAt > DAY) return initialWorkflow
  const state = envelope.state as Partial<WorkflowState> | undefined
  if (!state || typeof state.roughInput !== 'string' || typeof state.finalPrompt !== 'string') return initialWorkflow
  const restored: WorkflowState = {
    ...initialWorkflow, answers: {}, inputMode: state.inputMode === 'voice' ? 'voice' : 'text',
    roughInput: state.roughInput.slice(0, 20000), transcript: typeof state.transcript === 'string' ? state.transcript.slice(0, 20000) : '',
    analysis: analysis(state.analysis) ? state.analysis : null, methodology: method(state.methodology) ? state.methodology : null,
    methodologyInstructions: typeof state.methodologyInstructions === 'string' ? state.methodologyInstructions.slice(0, 5000) : '',
    finalPrompt: state.finalPrompt.slice(0, 30000), assumptions: strings(state.assumptions) ? state.assumptions : [],
  }
  if (Array.isArray(state.questions)) restored.questions = state.questions.filter((q) => q && typeof q.id === 'string' && typeof q.question === 'string' && typeof q.relevance === 'string' && strings(q.choices)).slice(0, 3)
  for (const q of restored.questions) {
    const answer = state.answers?.[q.id]
    restored.answers[q.id] = { questionId: q.id, question: q.question, answer: typeof answer?.answer === 'string' ? answer.answer.slice(0, 5000) : '', skipped: answer?.skipped === true }
  }
  const checkpoint = restored.finalPrompt ? 'review' : restored.analysis && restored.methodology ? 'methodology' : restored.roughInput ? 'transcript' : 'welcome'
  const safe = ['welcome', 'transcript', 'methodology', 'questions', 'review', 'complete']
  restored.stage = state.stage && safe.includes(state.stage) ? state.stage : checkpoint
  if (['methodology', 'questions'].includes(restored.stage) && (!restored.analysis || !restored.methodology)) restored.stage = checkpoint
  if (['review', 'complete'].includes(restored.stage) && !restored.finalPrompt) restored.stage = checkpoint
  if (state.stage !== restored.stage) restored.error = 'The previous operation was interrupted. Your saved work is ready to continue.'
  return restored
}

function loadLocalWorkflow(): WorkflowState {
  try { return restoreWorkflow(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return initialWorkflow }
}

export function useWorkflow() {
  const usesChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
  const storageKey = useRef(KEY)
  const [state, dispatch] = useReducer(workflowReducer, undefined, () => usesChromeStorage ? initialWorkflow : loadLocalWorkflow())
  const [ready, setReady] = useState(!usesChromeStorage)
  useEffect(() => {
    if (!usesChromeStorage) return
    const windowId = chrome.windows?.getCurrent ? chrome.windows.getCurrent().then((window) => window.id) : Promise.resolve(undefined)
    windowId.then((id) => {
      storageKey.current = id === undefined ? KEY : `${KEY}:${id}`
      return chrome.storage.local.get(storageKey.current)
    }).then((value) => {
      dispatch({ type: 'HYDRATE', state: restoreWorkflow(value[storageKey.current]) })
      setReady(true)
    }).catch(() => setReady(true))
    if (chrome.storage.local.remove) void chrome.storage.local.get(null).then((items) => {
      const expired = Object.entries(items).filter(([key, value]) => {
        const envelope = value as { version?: number; savedAt?: number } | null
        return key.startsWith(KEY) && envelope?.version === 2 && typeof envelope.savedAt === 'number' && Date.now() - envelope.savedAt > DAY
      }).map(([key]) => key)
      if (expired.length) return chrome.storage.local.remove(expired)
    }).catch(() => undefined)
  }, [usesChromeStorage])
  useEffect(() => {
    if (!ready) return
    const saved = { version: 2, savedAt: Date.now(), state }
    if (usesChromeStorage) chrome.storage.local.set({ [storageKey.current]: saved }).catch(() => undefined)
    else { try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch { /* Workflow remains usable without persistence. */ } }
  }, [ready, state, usesChromeStorage])
  return [state, dispatch, ready] as const
}
