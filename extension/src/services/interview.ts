import type { FollowUpAnswer } from '../state/workflow'

/** Stable fingerprint of the answers an adaptive question was generated from. */
export function answerBasis(answers: (FollowUpAnswer | undefined)[]): string {
  return JSON.stringify(answers.map((item) => item ? [item.questionId, item.skipped ? null : item.answer.trim()] : null))
}

const POSITION_WORDS: Record<string, number> = {
  one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6,
}
const LETTERS: Record<string, number> = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }
const FILLER = new Set(['the', 'a', 'an', 'i', 'it', 'is', 'and', 'or', 'of', 'to', 'for', 'with', 'my', 'me', 'we', 'want', 'would', 'like', 'please', 'option', 'choose', 'pick', 'select', 'go', 'think', 'that', 'this', 'one', 'be', 'should', 'just', 'um', 'uh', 'so', 'yeah', 'ok', 'okay', 'let', 's', 'll'])
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
const keywords = (text: string) => normalize(text).split(' ').filter((word) => word && !FILLER.has(word))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Reads "option two", "number 3", "the second one", "option B" from a short utterance. */
function spokenPosition(spoken: string): number {
  const words = spoken.split(' ')
  if (words.length > 6) return 0
  const cleaned = spoken
    .replace(/^(?:i ll |i will |i |let s |lets )?(?:choose|pick|go with|select|take)\s+/, '')
    .replace(/\s+please$/, '')
    .replace(/^the\s+/, '')
  const labelled = cleaned.match(/^(?:option|number|choice|answer)\s+([a-f]|\d|one|two|three|four|five|six)$/)
  if (labelled) {
    const key = labelled[1]
    return /^\d$/.test(key) ? Number(key) : LETTERS[key] ?? POSITION_WORDS[key] ?? 0
  }
  const bare = cleaned.match(/^(\d|one|two|three|four|five|six|first|second|third|fourth|fifth|sixth)(?:\s+(?:one|option))?$/)
  if (bare) return /^\d$/.test(bare[1]) ? Number(bare[1]) : POSITION_WORDS[bare[1]] ?? 0
  return 0
}

/**
 * Maps a spoken answer onto one of the displayed choices.
 * Returns the matching choice index, or -1 when the speech should be kept as a custom answer.
 */
export function matchSpokenChoice(transcript: string, choices: string[]): number {
  const spoken = normalize(transcript)
  if (!spoken || !choices.length) return -1
  const normalizedChoices = choices.map(normalize)
  const exact = normalizedChoices.indexOf(spoken)
  if (exact >= 0) return exact
  const position = spokenPosition(spoken)
  if (position >= 1 && position <= choices.length) return position - 1
  // The utterance contains a whole choice, e.g. "I think intermediate learners". A long answer that
  // merely contains a choice ("Yes, but only for staff…") carries extra detail, so it stays custom.
  const spokenWords = spoken.split(' ').length
  const contained = normalizedChoices
    .map((text, index) => ({ index, text }))
    .filter(({ text }) => text.length >= 3 && spokenWords <= text.split(' ').length + 4 && new RegExp(`(^| )${escape(text)}( |$)`).test(spoken))
    .sort((a, b) => b.text.length - a.text.length)
  if (contained.length === 1 || (contained.length > 1 && contained[0].text.length > contained[1].text.length)) return contained[0].index
  // Strong keyword overlap with exactly one choice; answers with much extra detail stay custom.
  const said = new Set(keywords(transcript))
  if (!said.size) return -1
  const scores = choices.map((choice) => {
    const words = keywords(choice)
    if (!words.length || said.size > words.length + 4) return 0
    return words.filter((word) => said.has(word)).length / words.length
  })
  const best = Math.max(...scores)
  return best >= 0.6 && scores.filter((score) => score === best).length === 1 ? scores.indexOf(best) : -1
}

/** Natural spoken form of a multiple-choice question. */
export function spokenQuestion(position: number, question: string, choices: string[]): string {
  const options = choices.map((choice, index) => `Option ${index + 1}: ${choice}.`).join(' ')
  return choices.length
    ? `Question ${position}. ${question} ${options} Say an option number, or describe your own answer.`
    : `Question ${position}. ${question} Please answer in your own words.`
}
