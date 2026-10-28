import { describe, expect, test } from 'vitest'
import type { FollowUpQuestion } from '../contracts'
import { initialWorkflow, workflowReducer } from './workflow'

const question = (id: string): FollowUpQuestion => ({
  id, question: `Question ${id}`, relevance: 'It changes the result', choices: [], skippable: true,
})

describe('workflow reducer', () => {
  test('limits follow-ups to three and initializes deterministic answers', () => {
    const state = workflowReducer(initialWorkflow, {
      type: 'SET_QUESTIONS', questions: ['a', 'b', 'c', 'd'].map(question),
    })
    expect(state.questions.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
    expect(Object.keys(state.answers)).toEqual(['a', 'b', 'c'])
  })

  test('supports custom answers and explicit skipping', () => {
    const asked = workflowReducer(initialWorkflow, { type: 'SET_QUESTIONS', questions: [question('scope')] })
    const answered = workflowReducer(asked, { type: 'ANSWER', questionId: 'scope', answer: 'Internal users' })
    const skipped = workflowReducer(answered, { type: 'SKIP', questionId: 'scope' })
    expect(answered.answers.scope.answer).toBe('Internal users')
    expect(skipped.answers.scope).toEqual({ questionId: 'scope', question: 'Question scope', answer: '', skipped: true })
  })
})
