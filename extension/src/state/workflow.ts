import type { FollowUpQuestion, IntentAnalysis, Methodology, WorkflowStage } from '../contracts'

export interface FollowUpAnswer {
  questionId: string
  answer: string
  skipped: boolean
}

export interface WorkflowState {
  stage: WorkflowStage
  roughInput: string
  transcript: string
  analysis: IntentAnalysis | null
  methodology: Methodology | null
  methodologyInstructions: string
  questions: FollowUpQuestion[]
  answers: Record<string, FollowUpAnswer>
  finalPrompt: string
  assumptions: string[]
  error: string | null
}

export const initialWorkflow: WorkflowState = {
  stage: 'welcome', roughInput: '', transcript: '', analysis: null, methodology: null,
  methodologyInstructions: '', questions: [], answers: {}, finalPrompt: '', assumptions: [], error: null,
}

export type WorkflowAction =
  | { type: 'SET_INPUT'; value: string }
  | { type: 'SET_STAGE'; stage: WorkflowStage }
  | { type: 'SET_TRANSCRIPT'; value: string }
  | { type: 'SET_ANALYSIS'; analysis: IntentAnalysis }
  | { type: 'SELECT_METHODOLOGY'; methodology: Methodology; instructions?: string }
  | { type: 'SET_QUESTIONS'; questions: FollowUpQuestion[] }
  | { type: 'ANSWER'; questionId: string; answer: string }
  | { type: 'SKIP'; questionId: string }
  | { type: 'SET_PROMPT'; prompt: string; assumptions?: string[] }
  | { type: 'FAIL'; message: string }
  | { type: 'RESET' }

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'SET_INPUT': return { ...state, roughInput: action.value }
    case 'SET_STAGE': return { ...state, stage: action.stage, error: null }
    case 'SET_TRANSCRIPT': return { ...state, transcript: action.value, roughInput: action.value, stage: 'transcript' }
    case 'SET_ANALYSIS': return { ...state, analysis: action.analysis, methodology: action.analysis.methodology, stage: 'methodology' }
    case 'SELECT_METHODOLOGY': return { ...state, methodology: action.methodology, methodologyInstructions: action.instructions ?? '', stage: 'questions' }
    case 'SET_QUESTIONS': {
      const questions = action.questions.slice(0, 3)
      const answers = Object.fromEntries(questions.map((question) => [question.id, { questionId: question.id, answer: '', skipped: false }]))
      return { ...state, questions, answers, stage: questions.length ? 'questions' : 'generating' }
    }
    case 'ANSWER': return { ...state, answers: { ...state.answers, [action.questionId]: { questionId: action.questionId, answer: action.answer, skipped: false } } }
    case 'SKIP': return { ...state, answers: { ...state.answers, [action.questionId]: { questionId: action.questionId, answer: '', skipped: true } } }
    case 'SET_PROMPT': return { ...state, finalPrompt: action.prompt, assumptions: action.assumptions ?? [], stage: 'review' }
    case 'FAIL': return { ...state, stage: 'error', error: action.message }
    case 'RESET': return initialWorkflow
  }
}
