import { beforeEach, expect, test } from 'vitest'
import type { PromptingStrategy } from '../contracts'
import { clearFeedback, describeTechnique, learnedLessons, loadFeedback, reasonsFromSpeech, recordFeedback, revisionFromFeedback, type FeedbackEntry } from './feedbackMemory'

beforeEach(() => localStorage.clear())

const entry = (reasons: FeedbackEntry['reasons'], note = '', extra: Partial<FeedbackEntry> = {}): FeedbackEntry => ({ at: Date.now(), reasons, note, domain: 'marketing', technique: 'few-shot (3 examples)', ...extra })

test('repeated complaints rank first and count as stronger penalties', () => {
  const lessons = learnedLessons([entry(['too_vague']), entry(['too_long']), entry(['too_long', 'wrong_tone'])])
  expect(lessons[0]).toBe('Keep prompts concise; the user found earlier prompts too long. (flagged 2 times)')
  expect(lessons).toContain('Match the tone and style the user asked for more closely.')
  expect(lessons).toHaveLength(3)
})

test('a rejected technique becomes a specific lesson and recent notes are kept', () => {
  const lessons = learnedLessons([entry(['wrong_technique'], 'Less corporate please', { domain: 'software', technique: 'zero-shot' }), entry([], 'Use bullet points')])
  expect(lessons[0]).toContain('Avoid zero-shot for software tasks')
  expect(lessons).toContain('Earlier feedback from the user: "Use bullet points"')
  expect(lessons).toContain('Earlier feedback from the user: "Less corporate please"')
  expect(learnedLessons([])).toEqual([])
})

test('lessons stay bounded for the backend contract', () => {
  const many = Array.from({ length: 30 }, (_, index) => entry(['too_long', 'too_vague', 'wrong_tone', 'bad_format', 'bad_examples', 'missed_requirements', 'invented_scope', 'wrong_technique'], `note ${index} ${'x'.repeat(400)}`, { technique: `t${index}` }))
  const lessons = learnedLessons(many)
  expect(lessons.length).toBeLessThanOrEqual(8)
  expect(lessons.every((lesson) => lesson.length <= 300)).toBe(true)
})

test('feedback persists, ignores corrupt or expired entries, and can be forgotten', async () => {
  await recordFeedback({ reasons: ['too_long'], note: '  shorter  ', domain: 'software', technique: 'zero-shot' })
  const stored = await loadFeedback()
  expect(stored).toHaveLength(1)
  expect(stored[0].note).toBe('shorter')
  localStorage.setItem('voicePromptFeedback', JSON.stringify([...stored, { reasons: ['nonsense'] }, { ...stored[0], at: Date.now() - 100 * 24 * 60 * 60 * 1000 }]))
  expect(await loadFeedback()).toHaveLength(1)
  await clearFeedback()
  expect(await loadFeedback()).toEqual([])
})

test('spoken feedback ticks matching reasons', () => {
  expect(reasonsFromSpeech('It is way too long and the tone is too formal')).toEqual(['too_long', 'wrong_tone'])
  expect(reasonsFromSpeech('You missed the budget and the examples were not helpful')).toEqual(['missed_requirements', 'bad_examples'])
  expect(reasonsFromSpeech('Looks fine, just swap the title')).toEqual([])
})

test('revision request names the problems, the change and any new technique', () => {
  const revision = revisionFromFeedback(['too_long', 'wrong_technique'], 'Make it friendlier', 'one-shot + chain-of-thought')
  expect(revision).toBe('The user rejected the previous prompt. Problems they flagged: Too long; Wrong prompting technique. What they want changed: Make it friendlier They asked for a different prompting technique: one-shot + chain-of-thought. Fix every flagged problem and do not repeat it. Preserve confirmed decisions and requirements.')
  const strategy = { examples: 'few_shot', example_count: 4, reasoning: 'chain_of_thought' } as PromptingStrategy
  expect(describeTechnique(strategy)).toBe('few-shot (4 examples) + chain-of-thought')
  expect(describeTechnique(undefined)).toBe('the default technique')
})
