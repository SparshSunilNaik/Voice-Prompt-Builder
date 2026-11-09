import { expect, test } from 'vitest'
import { SilenceTracker } from './silenceDetector'

/** Feeds `level` every 100 ms from `from` until `to` and returns the first non-continue verdict. */
function run(tracker: SilenceTracker, level: number, from: number, to: number) {
  for (let now = from; now <= to; now += 100) {
    const verdict = tracker.feed(level, now)
    if (verdict !== 'continue') return { verdict, at: now }
  }
  return { verdict: 'continue' as const, at: to }
}

test('ends the answer after a pause that follows real speech', () => {
  const tracker = new SilenceTracker({ silenceMs: 1500, minSpeechMs: 300 })
  expect(run(tracker, 0.001, 0, 900).verdict).toBe('continue')
  expect(run(tracker, 0.1, 1000, 2500).verdict).toBe('continue')
  expect(tracker.heardSpeech).toBe(true)
  const end = run(tracker, 0.001, 2600, 6000)
  expect(end).toEqual({ verdict: 'silence', at: 4100 })
})

test('short pauses between words do not end the answer', () => {
  const tracker = new SilenceTracker({ silenceMs: 1500 })
  run(tracker, 0.1, 0, 800)
  expect(run(tracker, 0.001, 900, 1800).verdict).toBe('continue')
  expect(run(tracker, 0.1, 1900, 2500).verdict).toBe('continue')
  expect(run(tracker, 0.001, 2600, 3500).verdict).toBe('continue')
})

test('reports no speech when nobody answers, and ignores a brief click', () => {
  const tracker = new SilenceTracker({ noSpeechMs: 5000, minSpeechMs: 300 })
  tracker.feed(0.2, 0)
  tracker.feed(0.2, 100) // 100 ms of noise is not an answer
  expect(run(tracker, 0.001, 200, 10000)).toEqual({ verdict: 'no_speech', at: 5000 })
})
