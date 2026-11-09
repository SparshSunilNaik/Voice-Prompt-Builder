import { MAX_INTERVIEW_QUESTIONS, type FollowUpQuestion, type IntentAnalysis, type Methodology, type WorkflowStage } from '../contracts'

export interface FollowUpAnswer {
  questionId: string
  question: string
  answer: string
  skipped: boolean
}

export interface WorkflowState {
  inputMode: 'text' | 'voice'
  stage: WorkflowStage
  roughInput: string
  transcript: string
  analysis: IntentAnalysis | null
  methodology: Methodology | null
  methodologyInstructions: string
  questions: FollowUpQuestion[]
  answers: Record<string, FollowUpAnswer>
  /** Fingerprint of the earlier answers each adaptive question was generated from. */
  questionBasis: Record<string, string>
  /** Set when the interviewer decided it has enough context; holds the basis it decided on. */
  interviewDoneBasis: string | null
  finalPrompt: string
  assumptions: string[]
  error: string | null
}

export const initialWorkflow: WorkflowState = {
  inputMode: 'text',
  stage: 'welcome', roughInput: '', transcript: '', analysis: null, methodology: null,
  methodologyInstructions: '', questions: [], answers: {}, questionBasis: {}, interviewDoneBasis: null, finalPrompt: '', assumptions: [], error: null,
}

export type WorkflowAction =
  | { type: 'SET_MODE'; mode: 'text' | 'voice' }
  | { type: 'SET_INPUT'; value: string }
  | { type: 'SET_STAGE'; stage: WorkflowStage }
  | { type: 'SET_TRANSCRIPT'; value: string }
  | { type: 'SET_ANALYSIS'; analysis: IntentAnalysis }
  | { type: 'SELECT_METHODOLOGY'; methodology: Methodology; instructions?: string }
  | { type: 'EDIT_METHODOLOGY'; methodology?: Methodology; instructions?: string }
  | { type: 'SET_QUESTIONS'; questions: FollowUpQuestion[] }
  | { type: 'ADVANCE_INTERVIEW'; keep: number; basis: string; methodology: Methodology; question: FollowUpQuestion | null }
  | { type: 'ANSWER'; questionId: string; answer: string }
  | { type: 'SKIP'; questionId: string }
  | { type: 'SET_PROMPT'; prompt: string; assumptions?: string[] }
  | { type: 'EDIT_PROMPT'; prompt: string }
  | { type: 'HYDRATE'; state: WorkflowState }
  | { type: 'FAIL'; message: string }
  | { type: 'RESET' }

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'SET_MODE': return { ...state, inputMode: action.mode }
    case 'SET_INPUT': return { ...state, roughInput: action.value, analysis: null, methodology: null, methodologyInstructions: '', questions: [], answers: {}, questionBasis: {}, interviewDoneBasis: null, finalPrompt: '', assumptions: [] }
    case 'SET_STAGE': return { ...state, stage: action.stage, error: null }
    case 'SET_TRANSCRIPT': return { ...state, transcript: action.value, roughInput: action.value, stage: 'transcript' }
    case 'SET_ANALYSIS': return { ...state, analysis: action.analysis, methodology: action.analysis.methodology, stage: 'methodology' }
    case 'SELECT_METHODOLOGY': return { ...state, methodology: action.methodology, methodologyInstructions: action.instructions ?? '', stage: 'questions' }
    case 'EDIT_METHODOLOGY': return { ...state, methodology: action.methodology ?? state.methodology, methodologyInstructions: action.instructions ?? state.methodologyInstructions }
    case 'SET_QUESTIONS': {
      const questions = action.questions.slice(0, MAX_INTERVIEW_QUESTIONS)
      const answers = Object.fromEntries(questions.map((question) => [question.id, state.answers[question.id]?.question === question.question ? state.answers[question.id] : { questionId: question.id, question: question.question, answer: '', skipped: false }]))
      return { ...state, questions, answers, questionBasis: {}, interviewDoneBasis: null, stage: questions.length ? 'questions' : 'generating' }
    }
    case 'ADVANCE_INTERVIEW': {
      // Later questions were planned from answers that may have changed, so drop them.
      const kept = state.questions.slice(0, action.keep)
      const question = action.question && kept.length < MAX_INTERVIEW_QUESTIONS ? action.question : null
      const questions = question ? [...kept, question] : kept
      const answers: Record<string, FollowUpAnswer> = {}
      for (const q of kept) if (state.answers[q.id]) answers[q.id] = state.answers[q.id]
      if (question) answers[question.id] = { questionId: question.id, question: question.question, answer: '', skipped: false }
      const questionBasis: Record<string, string> = {}
      for (const q of kept) questionBasis[q.id] = state.questionBasis[q.id] ?? ''
      if (question) questionBasis[question.id] = action.basis
      return { ...state, questions, answers, questionBasis, interviewDoneBasis: question ? null : action.basis, methodology: action.methodology, stage: 'questions' }
    }
    case 'ANSWER': return { ...state, answers: { ...state.answers, [action.questionId]: { questionId: action.questionId, question: state.questions.find((q) => q.id === action.questionId)?.question ?? '', answer: action.answer, skipped: false } } }
    case 'SKIP': return { ...state, answers: { ...state.answers, [action.questionId]: { questionId: action.questionId, question: state.questions.find((q) => q.id === action.questionId)?.question ?? '', answer: '', skipped: true } } }
    case 'SET_PROMPT': return { ...state, finalPrompt: action.prompt, assumptions: action.assumptions ?? [], stage: 'review' }
    case 'EDIT_PROMPT': return { ...state, finalPrompt: action.prompt }
    case 'HYDRATE': return action.state
    case 'FAIL': return { ...state, stage: 'error', error: action.message }
    case 'RESET': return initialWorkflow
  }
}
