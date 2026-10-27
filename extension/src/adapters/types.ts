export interface PlatformAdapter {
  platform: 'ChatGPT' | 'Claude' | 'Gemini'
  hostname: string
  findComposer(document: Document): HTMLElement | null
}
