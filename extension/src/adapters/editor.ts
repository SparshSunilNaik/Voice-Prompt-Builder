import type { PlatformAdapter } from './types'

function normalized(value: string): string { return value.replace(/\r\n/g, '\n').trim() }

export function editorValue(element: HTMLElement): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value
  return element.innerText || element.textContent || ''
}

export function setEditorValue(element: HTMLElement, prompt: string): void {
  element.focus()
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    setter?.call(element, prompt)
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
    return
  }

  const before = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: prompt })
  if (!element.dispatchEvent(before)) return
  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(element)
  selection?.removeAllRanges()
  selection?.addRange(range)
  const inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, prompt)
  if (!inserted) element.textContent = prompt
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }))
}

export async function insertWithAdapter(adapter: PlatformAdapter, prompt: string): Promise<boolean> {
  const composer = adapter.findComposer(document)
  if (!composer || !composer.isConnected) return false
  setEditorValue(composer, prompt)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (normalized(editorValue(composer)) === normalized(prompt)) return true
  }
  return false
}

export function firstVisible(selectors: string[], root: Document = document): HTMLElement | null {
  for (const selector of selectors) {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector))
    const candidate = candidates.find((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
    if (candidate) return candidate
  }
  return null
}
