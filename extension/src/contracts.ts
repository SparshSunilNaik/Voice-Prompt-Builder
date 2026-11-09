// Gnani's synchronous REST endpoint accepts clips up to 30 seconds.
export const MAX_RECORDING_SECONDS = 30

export type WorkflowStage =
  | 'welcome' | 'listening' | 'transcribing' | 'transcript'
  | 'analyzing' | 'methodology' | 'questions' | 'generating'
  | 'review' | 'complete' | 'error'

export interface Methodology {
  name: string
  description: string
  rationale: string
  prompting?: PromptingStrategy
}

export const MAX_INTERVIEW_QUESTIONS = 8

export type SupportingTechnique = 'role_prompting' | 'structured_output' | 'step_back' | 'self_consistency' | 'self_critique' | 'constraint_checklist'

export interface PromptingStrategy {
  example_count?: number
  example_source?: 'none' | 'user_supplied' | 'illustrative'
  examples: 'zero_shot' | 'one_shot' | 'few_shot'
  reasoning: 'direct' | 'chain_of_thought' | 'decompose_and_verify'
  techniques?: SupportingTechnique[]
  execution: 'single_pass' | 'bounded_iteration'
  max_iterations: number
  rationale: string
  example_requirement: string
  success_criteria: string[]
}

export interface PromptQualityReview {
  verdict: 'ready' | 'needs_revision' | 'needs_input'
  strengths: string[]
  issues: { severity: 'high' | 'medium' | 'low'; issue: string; improvement: string; evidence?: string }[]
  missing_inputs: string[]
  recommended_strategy: PromptingStrategy
  review_notes?: string[]
}
export interface ReviewResponse { report: PromptQualityReview; usage: UsageMetadata; model: string }

export interface FollowUpQuestion {
  id: string
  question: string
  relevance: string
  choices: string[]
  skippable: boolean
}

export interface IntentAnalysis {
  goal: string
  context: string
  intended_output: string
  known_requirements: string[]
  missing_requirements: string[]
  constraints: string[]
  domain: string
  ambiguity: string[]
  risks: string[]
  methodology: Methodology
  alternatives: Methodology[]
}

export interface UsageMetadata { prompt_tokens: number; completion_tokens: number; total_tokens: number }
export interface AnalyzeResponse { analysis: IntentAnalysis; usage: UsageMetadata; model: string }
export interface RefineResponse { questions: FollowUpQuestion[]; usage: UsageMetadata; model: string }
export interface NextQuestionResponse { done: boolean; question: FollowUpQuestion | null; methodology: Methodology; reason: string; asked: number; limit: number; usage: UsageMetadata; model: string }
export interface GenerateResponse { prompt: string; assumptions: string[]; usage: UsageMetadata; model: string }
