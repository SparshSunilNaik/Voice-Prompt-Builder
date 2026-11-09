import { afterEach, expect, test, vi } from 'vitest'
import { speakQuestion, stopSpeaking } from './speech'

afterEach(() => vi.unstubAllGlobals())
test('uses browser speech, prefers a matching local voice, and cancels playback', () => {
  class Utterance { text: string; lang = ''; voice: unknown; constructor(text: string) { this.text = text } }
  const local = { localService: true, lang: navigator.language }
  const speech = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [local] }
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  vi.stubGlobal('speechSynthesis', speech)
  expect(speakQuestion('Who will use this?', vi.fn())).toBe(true)
  expect(speech.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Who will use this?', voice: local }))
  stopSpeaking()
  expect(speech.cancel).toHaveBeenCalledTimes(2)
})

test('signals the end of speech once, but not when playback is cancelled', () => {
  class Utterance { text: string; lang = ''; voice: unknown; onend?: () => void; onerror?: (event: { error: string }) => void; constructor(text: string) { this.text = text } }
  const spoken: Utterance[] = []
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
  vi.stubGlobal('speechSynthesis', { speak: (utterance: Utterance) => spoken.push(utterance), cancel: vi.fn(), getVoices: () => [], speaking: false })
  const ended = vi.fn()
  speakQuestion('Question one?', vi.fn(), ended)
  spoken[0].onend?.(); spoken[0].onend?.()
  expect(ended).toHaveBeenCalledOnce()
  const interrupted = vi.fn(); const failed = vi.fn()
  speakQuestion('Question two?', failed, interrupted)
  spoken[1].onerror?.({ error: 'interrupted' })
  expect(interrupted).not.toHaveBeenCalled()
  expect(failed).not.toHaveBeenCalled()
})

test('a watchdog continues when Chrome never reports the end of speech', () => {
  vi.useFakeTimers()
  try {
    class Utterance { text: string; lang = ''; voice: unknown; onend?: () => void; onerror?: () => void; constructor(text: string) { this.text = text } }
    const speech = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [], speaking: true }
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
    vi.stubGlobal('speechSynthesis', speech)
    const ended = vi.fn()
    speakQuestion('Who is it for?', vi.fn(), ended)
    vi.advanceTimersByTime(2000)
    expect(ended).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(ended).toHaveBeenCalledOnce()
    expect(speech.cancel).toHaveBeenCalledTimes(2)
  } finally { vi.useRealTimers() }
})

test('reports missing speech support so voice capture and text fallback remain usable', async () => {
  vi.stubGlobal('speechSynthesis', undefined)
  const failed = vi.fn()
  expect(speakQuestion('Question?', failed)).toBe(false)
  await Promise.resolve()
  expect(failed).toHaveBeenCalledOnce()
})
