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

test('reports missing speech support so voice capture and text fallback remain usable', async () => {
  vi.stubGlobal('speechSynthesis', undefined)
  const failed = vi.fn()
  expect(speakQuestion('Question?', failed)).toBe(false)
  await Promise.resolve()
  expect(failed).toHaveBeenCalledOnce()
})
