export type WorkflowStage =
  | 'welcome' | 'listening' | 'transcribing' | 'transcript'
  | 'analyzing' | 'methodology' | 'questions' | 'generating'
  | 'review' | 'complete' | 'error'

export interface Methodology {
  name: string
  description: string
  rationale: string
}

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
