export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

export function speakQuestion(text: string, onError: () => void): boolean {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') { queueMicrotask(onError); return false }
  stopSpeaking()
  try {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = navigator.language || 'en-IN'
  utterance.voice = speechSynthesis.getVoices().find((voice) => voice.localService && voice.lang.split('-')[0] === utterance.lang.split('-')[0]) ?? null
  utterance.onerror = (event) => { if (event.error !== 'canceled' && event.error !== 'interrupted') onError() }
  speechSynthesis.speak(utterance)
  return true
  } catch { queueMicrotask(onError); return false }
}
