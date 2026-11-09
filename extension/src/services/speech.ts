export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

/**
 * Speaks text with the browser voice. onEnd fires once when playback finishes (not when cancelled);
 * a watchdog covers Chrome builds that never fire end events for long utterances.
 */
export function speakQuestion(text: string, onError: () => void, onEnd?: () => void): boolean {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') { queueMicrotask(onError); return false }
  stopSpeaking()
  try {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = navigator.language || 'en-IN'
  utterance.voice = speechSynthesis.getVoices().find((voice) => voice.localService && voice.lang.split('-')[0] === utterance.lang.split('-')[0]) ?? null
  let settled = false
  let watchdog = 0
  const finish = () => { if (settled) return; settled = true; window.clearTimeout(watchdog); onEnd?.() }
  utterance.onend = finish
  utterance.onerror = (event) => {
    window.clearTimeout(watchdog)
    if (event.error === 'canceled' || event.error === 'interrupted') { settled = true; return }
    settled = true
    onError()
  }
  // ~450 ms per word is slower than typical speech, so this only fires when Chrome hangs.
  if (onEnd) watchdog = window.setTimeout(() => {
    if (settled) return
    finish()
    if (speechSynthesis.speaking) speechSynthesis.cancel()
  }, 2500 + text.split(/\s+/).length * 450)
  speechSynthesis.speak(utterance)
  return true
  } catch { queueMicrotask(onError); return false }
}
