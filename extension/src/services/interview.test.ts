import { describe, expect, test } from 'vitest'
import { answerBasis, matchSpokenChoice, spokenQuestion } from './interview'

const levels = ['Beginners', 'Intermediate learners', 'Advanced engineers']

describe('spoken choice matching', () => {
  test.each([
    ['option two', 1], ['Option 3.', 2], ['number one', 0], ['the second one', 1], ['first', 0],
    ['I choose option 1', 0], ['option B', 1], ['3', 2], ['two please', 1],
  ])('maps "%s" to option index %i', (spoken, index) => {
    expect(matchSpokenChoice(spoken, levels)).toBe(index)
  })

  test('matches spoken choice text, including inside a sentence', () => {
    expect(matchSpokenChoice('beginners', levels)).toBe(0)
    expect(matchSpokenChoice('I think intermediate learners, mostly', levels)).toBe(1)
    expect(matchSpokenChoice('advanced engineers please', levels)).toBe(2)
    expect(matchSpokenChoice('mostly advanced folks who are engineers', levels)).toBe(2)
  })

  test('keeps ambiguous, out-of-range or long answers as custom answers', () => {
    expect(matchSpokenChoice('option five', levels)).toBe(-1)
    expect(matchSpokenChoice('a mix of students and managers', levels)).toBe(-1)
    expect(matchSpokenChoice('', levels)).toBe(-1)
    expect(matchSpokenChoice('yes', [])).toBe(-1)
    expect(matchSpokenChoice('Yes, but only for internal staff on weekdays, and it should export a report too', ['Yes', 'No'])).toBe(-1)
  })

  test('does not treat the article "a" as option A', () => {
    expect(matchSpokenChoice('a', ['Email', 'Phone'])).toBe(-1)
    expect(matchSpokenChoice('a phone call', ['Email', 'Phone call'])).toBe(1)
  })
})

test('reads options aloud with their numbers', () => {
  expect(spokenQuestion(2, 'Who is it for?', ['Students', 'Teachers'])).toBe('Question 2. Who is it for? Option 1: Students. Option 2: Teachers. Say an option number, or describe your own answer.')
  expect(spokenQuestion(1, 'Anything else?', [])).toBe('Question 1. Anything else? Please answer in your own words.')
})

test('answer basis changes when an earlier answer or skip changes', () => {
  const answer = (value: string, skipped = false) => ({ questionId: 'q1', question: 'Q?', answer: value, skipped })
  expect(answerBasis([answer('Yes')])).toBe(answerBasis([answer(' Yes ')]))
  expect(answerBasis([answer('Yes')])).not.toBe(answerBasis([answer('No')]))
  expect(answerBasis([answer('Yes', true)])).not.toBe(answerBasis([answer('Yes')]))
})
