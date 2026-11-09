/** Hands-free end-of-answer detection for spoken replies. */

export interface SilenceOptions {
  /** Pause length after speech that ends the answer. */
  silenceMs?: number
  /** Give up when nobody speaks at all for this long. */
  noSpeechMs?: number
  /** Speech must last this long in total before a pause can end the answer. */
  minSpeechMs?: number
  /** RMS level (0-1) treated as speech. */
  threshold?: number
}

export type SilenceVerdict = 'continue' | 'silence' | 'no_speech'

/** Pure state machine fed with audio levels; separated from Web Audio so it can be unit tested. */
export class SilenceTracker {
  private readonly silenceMs: number
  private readonly noSpeechMs: number
  private readonly minSpeechMs: number
  readonly threshold: number
  private startedAt: number | null = null
  private lastSample: number | null = null
  private speechMs = 0
  private quietSince: number | null = null

  constructor({ silenceMs = 1600, noSpeechMs = 8000, minSpeechMs = 350, threshold = 0.02 }: SilenceOptions = {}) {
    this.silenceMs = silenceMs
    this.noSpeechMs = noSpeechMs
    this.minSpeechMs = minSpeechMs
    this.threshold = threshold
  }

  get heardSpeech() { return this.speechMs >= this.minSpeechMs }

  feed(level: number, now: number): SilenceVerdict {
    if (this.startedAt === null) this.startedAt = now
    const delta = this.lastSample === null ? 0 : Math.max(0, now - this.lastSample)
    this.lastSample = now
    if (level >= this.threshold) {
      this.speechMs += delta
      this.quietSince = null
      return 'continue'
    }
    if (!this.heardSpeech) return now - this.startedAt >= this.noSpeechMs ? 'no_speech' : 'continue'
    if (this.quietSince === null) this.quietSince = now
    return now - this.quietSince >= this.silenceMs ? 'silence' : 'continue'
  }
}

/**
 * Watches a live microphone stream and reports when the speaker has finished or never started.
 * Returns a cleanup function. Without Web Audio support it does nothing and recording stays manual.
 */
export function watchSilence(stream: MediaStream, onVerdict: (verdict: Exclude<SilenceVerdict, 'continue'>) => void, options?: SilenceOptions): () => void {
  const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined
  if (!AudioCtx) return () => undefined
  let context: AudioContext
  try { context = new AudioCtx() } catch { return () => undefined }
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  const source = context.createMediaStreamSource(stream)
  source.connect(analyser)
  const samples = new Float32Array(analyser.fftSize)
  const tracker = new SilenceTracker(options)
  let finished = false
  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (const sample of samples) sum += sample * sample
    const verdict = tracker.feed(Math.sqrt(sum / samples.length), performance.now())
    if (verdict !== 'continue' && !finished) { finished = true; cleanup(); onVerdict(verdict) }
  }, 100)
  function cleanup() {
    window.clearInterval(timer)
    try { source.disconnect() } catch { /* already disconnected */ }
    void context.close().catch(() => undefined)
  }
  return () => { finished = true; cleanup() }
}
