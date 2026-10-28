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
  if (normalized(editorValue(composer))) return normalized(editorValue(composer)) === normalized(prompt)
  setEditorValue(composer, prompt)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
    if (!composer.isConnected || adapter.findComposer(document) !== composer || normalized(editorValue(composer)) !== normalized(prompt)) return false
  }
  return true
}

export function firstVisible(selectors: string[], root: Document = document): HTMLElement | null {
  for (const selector of selectors) {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(selector))
    const candidate = candidates.find((element) => {
      if (element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]') || element.hasAttribute('disabled') || element.hasAttribute('readonly')) return false
      for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
      }
      return true
    })
    if (candidate) return candidate
  }
  return null
}
