import type { PromptingStrategy } from '../contracts'

/** Why the user rejected a generated prompt. Each reason becomes a lesson for later generations. */
export const FEEDBACK_REASONS = [
  { id: 'too_long', label: 'Too long', lesson: 'Keep prompts concise; the user found earlier prompts too long.' },
  { id: 'too_vague', label: 'Too vague', lesson: 'Be specific and concrete; the user found earlier prompts too vague.' },
  { id: 'missed_requirements', label: 'Missed what I asked', lesson: 'Cover every stated requirement explicitly; earlier prompts missed some.' },
  { id: 'invented_scope', label: 'Added things I didn’t ask for', lesson: 'Do not add features, constraints or details the user did not ask for.' },
  { id: 'wrong_tone', label: 'Wrong tone or style', lesson: 'Match the tone and style the user asked for more closely.' },
  { id: 'bad_format', label: 'Hard-to-use structure', lesson: 'Use a clearer, easier-to-follow structure with only useful headings.' },
  { id: 'bad_examples', label: 'Examples not helpful', lesson: 'Make examples realistic and relevant to the task, or leave them out when they add little.' },
  { id: 'wrong_technique', label: 'Wrong prompting technique', lesson: '' },
] as const

export type FeedbackReason = typeof FEEDBACK_REASONS[number]['id']

export interface FeedbackEntry {
  at: number
  reasons: FeedbackReason[]
  note: string
  domain: string
  /** Human-readable strategy of the rejected prompt, e.g. "few-shot + chain-of-thought". */
  technique: string
}

const KEY = 'voicePromptFeedback'
const MAX_ENTRIES = 25
const MAX_AGE = 90 * 24 * 60 * 60 * 1000
const MAX_LESSONS = 8
const reasonIds = new Set<string>(FEEDBACK_REASONS.map((reason) => reason.id))

export function describeTechnique(strategy?: PromptingStrategy): string {
  if (!strategy) return 'the default technique'
  const examples = strategy.examples === 'zero_shot' ? 'zero-shot' : strategy.examples === 'one_shot' ? 'one-shot' : `few-shot (${strategy.example_count ?? 3} examples)`
  const reasoning = strategy.reasoning === 'chain_of_thought' ? ' + chain-of-thought' : strategy.reasoning === 'decompose_and_verify' ? ' + decompose-and-verify' : ''
  return examples + reasoning
}

function valid(entry: unknown): entry is FeedbackEntry {
  if (!entry || typeof entry !== 'object') return false
  const item = entry as Record<string, unknown>
  return typeof item.at === 'number' && Array.isArray(item.reasons) && item.reasons.every((reason) => typeof reason === 'string' && reasonIds.has(reason))
    && typeof item.note === 'string' && typeof item.domain === 'string' && typeof item.technique === 'string'
}

function fresh(entries: unknown): FeedbackEntry[] {
  if (!Array.isArray(entries)) return []
  return entries.filter(valid).filter((entry) => Date.now() - entry.at <= MAX_AGE).slice(-MAX_ENTRIES)
}

const chromeStore = () => typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null

export async function loadFeedback(): Promise<FeedbackEntry[]> {
  try {
    const store = chromeStore()
    if (store) return fresh((await store.get(KEY))[KEY])
    return fresh(JSON.parse(localStorage.getItem(KEY) || '[]'))
  } catch { return [] }
}

async function save(entries: FeedbackEntry[]) {
  try {
    const store = chromeStore()
    if (store) await store.set({ [KEY]: entries })
    else localStorage.setItem(KEY, JSON.stringify(entries))
  } catch { /* Feedback still applies to this regeneration without persistence. */ }
}

export async function recordFeedback(entry: Omit<FeedbackEntry, 'at'>): Promise<FeedbackEntry[]> {
  const entries = fresh([...(await loadFeedback()), { ...entry, note: entry.note.trim().slice(0, 500), at: Date.now() }])
  await save(entries)
  return entries
}

export async function clearFeedback(): Promise<void> {
  try {
    const store = chromeStore()
    if (store?.remove) await store.remove(KEY)
    else if (store) await store.set({ [KEY]: [] })
    else localStorage.removeItem(KEY)
  } catch { /* Nothing stored. */ }
}

/**
 * Turns stored critiques into short lessons, most repeated first, so problems the user flagged
 * more often weigh more heavily in later generations.
 */
export function learnedLessons(entries: FeedbackEntry[]): string[] {
  const counts = new Map<string, number>()
  const bump = (lesson: string) => counts.set(lesson, (counts.get(lesson) ?? 0) + 1)
  for (const entry of entries) {
    for (const reason of entry.reasons) {
      if (reason === 'wrong_technique') bump(`Avoid ${entry.technique} for ${entry.domain || 'similar'} tasks unless the user asks for it; the user rejected it.`)
      else bump(FEEDBACK_REASONS.find((item) => item.id === reason)!.lesson)
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lesson, count]) => count > 1 ? `${lesson} (flagged ${count} times)` : lesson)
  const notes = entries.filter((entry) => entry.note).slice(-3).reverse().map((entry) => `Earlier feedback from the user: "${entry.note.slice(0, 200)}"`)
  return [...ranked.slice(0, MAX_LESSONS - Math.min(notes.length, 3)), ...notes].slice(0, MAX_LESSONS).map((lesson) => lesson.slice(0, 300))
}

const SPOKEN_REASONS: [FeedbackReason, RegExp][] = [
  ['too_long', /\b(too long|shorter|lengthy|wordy|too much text)\b/i],
  ['too_vague', /\b(vague|generic|not specific|unclear|more specific)\b/i],
  ['missed_requirements', /\b(missed|missing|forgot|left out|didn'?t include)\b/i],
  ['invented_scope', /\b(didn'?t ask|not asked|made up|added (stuff|things|extra))\b/i],
  ['wrong_tone', /\b(tone|style|too formal|too casual)\b/i],
  ['bad_format', /\b(format|structure|layout|messy|hard to (read|follow))\b/i],
  ['bad_examples', /\bexamples? (are|were|is|was) (bad|wrong|useless|not (helpful|useful|relevant))\b/i],
  ['wrong_technique', /\b(technique|few[- ]shot|one[- ]shot|zero[- ]shot|chain[- ]of[- ]thought|step by step)\b/i],
]

/** Reasons implied by spoken feedback such as "it's too long and the tone is off". */
export function reasonsFromSpeech(text: string): FeedbackReason[] {
  return SPOKEN_REASONS.filter(([, pattern]) => pattern.test(text)).map(([reason]) => reason)
}

/** Revision instruction for the regeneration the user just asked for. */
export function revisionFromFeedback(reasons: FeedbackReason[], note: string, techniqueChange?: string): string {
  const labels = reasons.map((id) => FEEDBACK_REASONS.find((reason) => reason.id === id)!.label)
  const parts = ['The user rejected the previous prompt.']
  if (labels.length) parts.push(`Problems they flagged: ${labels.join('; ')}.`)
  if (note.trim()) parts.push(`What they want changed: ${note.trim()}`)
  if (techniqueChange) parts.push(`They asked for a different prompting technique: ${techniqueChange}.`)
  parts.push('Fix every flagged problem and do not repeat it. Preserve confirmed decisions and requirements.')
  return parts.join(' ').slice(0, 5000)
}
