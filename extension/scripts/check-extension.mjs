import { readFileSync, existsSync } from 'node:fs'
import { Script, createContext } from 'node:vm'
const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'))
for (const script of manifest.content_scripts.flatMap((entry) => entry.js)) {
  const compiled = new Script(readFileSync(`dist/${script}`, 'utf8'), { filename: script })
  let listener
  const context = createContext({ chrome: { runtime: { id: 'package-test', onMessage: { addListener: (callback) => { listener = callback } } } } })
  compiled.runInContext(context)
  if (typeof listener !== 'function') throw new Error('Content script did not register its message listener')
  if (listener({ type: 'INSERT_PROMPT', prompt: 'Do not insert', approved: false }, { id: 'package-test' }, () => {}) !== false) throw new Error('Unapproved insertion was accepted')
}
for (const file of ['index.html', 'microphone-permission.html', manifest.background.service_worker]) {
  if (!existsSync(`dist/${file}`)) throw new Error(`Missing extension asset: ${file}`)
}
console.log('Extension package verified: classic content script and required entries.')
