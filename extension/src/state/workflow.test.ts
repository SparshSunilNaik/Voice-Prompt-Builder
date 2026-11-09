import { describe, expect, test } from 'vitest'
import type { FollowUpQuestion } from '../contracts'
import { initialWorkflow, workflowReducer } from './workflow'

const question = (id: string): FollowUpQuestion => ({
  id, question: `Question ${id}`, relevance: 'It changes the result', choices: [], skippable: true,
})

describe('workflow reducer', () => {
  test('limits follow-ups to the interview maximum and initializes deterministic answers', () => {
    const state = workflowReducer(initialWorkflow, {
      type: 'SET_QUESTIONS', questions: 'abcdefghij'.split('').map(question),
    })
    expect(state.questions.map(({ id }) => id)).toEqual('abcdefgh'.split(''))
    expect(Object.keys(state.answers)).toEqual('abcdefgh'.split(''))
  })

  test('supports custom answers and explicit skipping', () => {
    const asked = workflowReducer(initialWorkflow, { type: 'SET_QUESTIONS', questions: [question('scope')] })
    const answered = workflowReducer(asked, { type: 'ANSWER', questionId: 'scope', answer: 'Internal users' })
    const skipped = workflowReducer(answered, { type: 'SKIP', questionId: 'scope' })
    expect(answered.answers.scope.answer).toBe('Internal users')
    expect(skipped.answers.scope).toEqual({ questionId: 'scope', question: 'Question scope', answer: '', skipped: true })
  })

  test('adaptive interview appends questions and drops later ones when an earlier answer is re-planned', () => {
    const methodology = { name: 'M', description: 'D', rationale: 'R' }
    let state = workflowReducer(initialWorkflow, { type: 'ADVANCE_INTERVIEW', keep: 0, basis: '[]', methodology, question: question('a') })
    state = workflowReducer(state, { type: 'ANSWER', questionId: 'a', answer: 'Yes' })
    state = workflowReducer(state, { type: 'ADVANCE_INTERVIEW', keep: 1, basis: 'a=yes', methodology, question: question('b') })
    state = workflowReducer(state, { type: 'ANSWER', questionId: 'b', answer: 'Phones' })
    expect(state.questions.map(({ id }) => id)).toEqual(['a', 'b'])
    expect(state.questionBasis).toEqual({ a: '[]', b: 'a=yes' })
    const replanned = workflowReducer(state, { type: 'ADVANCE_INTERVIEW', keep: 1, basis: 'a=no', methodology: { ...methodology, name: 'Updated' }, question: question('c') })
    expect(replanned.questions.map(({ id }) => id)).toEqual(['a', 'c'])
    expect(Object.keys(replanned.answers)).toEqual(['a', 'c'])
    expect(replanned.answers.a.answer).toBe('Yes')
    expect(replanned.methodology?.name).toBe('Updated')
    expect(replanned.interviewDoneBasis).toBeNull()
    const done = workflowReducer(replanned, { type: 'ADVANCE_INTERVIEW', keep: 2, basis: 'final', methodology, question: null })
    expect(done.questions).toHaveLength(2)
    expect(done.interviewDoneBasis).toBe('final')
    expect(done.stage).toBe('questions')
  })
})
