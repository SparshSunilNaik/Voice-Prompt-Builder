// Web Locks coordinate extension pages across windows and survive worker suspension.
export async function acquireMicrophone(): Promise<() => void> {
  if (!navigator.locks) return () => undefined
  return new Promise((resolve, reject) => {
    void navigator.locks.request('voice-prompt-microphone', { ifAvailable: true }, async (lock) => {
      if (!lock) { reject(new Error('Another Voice Prompt Builder window is recording. Stop it before recording here.')); return }
      await new Promise<void>((unlock) => resolve(unlock))
    }).catch(reject)
  })
}
