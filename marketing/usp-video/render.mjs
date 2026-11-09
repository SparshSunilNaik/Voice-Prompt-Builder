// Renders index.html into an MP4 (1080x1080, 30 fps) by stepping window.render(t) frame by frame.
// Usage:
//   node render.mjs                 -> voice-prompt-builder-usp.mp4 (+ voice-over from voice/timeline.json) + poster.png
//   node render.mjs --silent        -> the original 30 s silent cut
//   node render.mjs --stills 2,6,12 -> stills/frame-<t>.png for quick review
// Needs Playwright with Chromium (resolved from ../../../hundredx-voice/node_modules by default,
// or set PLAYWRIGHT_PATH) and ffmpeg on PATH.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const playwrightPath = process.env.PLAYWRIGHT_PATH || resolve(here, '../../../hundredx-voice/node_modules/playwright')
const { chromium } = require(playwrightPath)

const FPS = 30
const SIZE = 1080
const stillsArg = process.argv.indexOf('--stills')

// Use an already-installed Playwright Chromium when the bundled build is missing (CHROME_PATH overrides).
function findChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const root = join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  if (!existsSync(root)) return undefined
  const builds = readdirSync(root).filter((name) => name.startsWith('chromium_headless_shell-')).sort().reverse()
  for (const build of builds) {
    const exe = join(root, build, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
    if (existsSync(exe)) return exe
  }
  return undefined
}
let browser
try { browser = await chromium.launch() } catch { browser = await chromium.launch({ executablePath: findChromium() }) }
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 })
await page.goto(pathToFileURL(join(here, 'index.html')).href)
await page.evaluate(() => document.fonts.ready)
// Sync to the voice-over when make-voice.py has produced one (pass --silent to ignore it).
const timelinePath = join(here, 'voice', 'timeline.json')
const voice = !process.argv.includes('--silent') && existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : null
if (voice) await page.evaluate((anchors) => window.useAnchors(anchors), voice.anchors)
const duration = await page.evaluate(() => window.DURATION)
const shot = async (t) => { await page.evaluate((time) => window.render(time), t); return page.screenshot({ type: 'png' }) }

if (stillsArg > -1) {
  const dir = join(here, 'stills')
  mkdirSync(dir, { recursive: true })
  for (const t of process.argv[stillsArg + 1].split(',').map(Number)) {
    await page.evaluate((time) => window.render(time), t)
    await page.screenshot({ path: join(dir, `frame-${t}.png`) })
  }
  console.log('stills written to', dir)
} else {
  const out = join(here, 'voice-prompt-builder-usp.mp4')
  // Voice clips go in as extra inputs, each delayed to its start time and mixed into one AAC track.
  const audioArgs = []
  if (voice) {
    voice.clips.forEach((c) => audioArgs.push('-i', join(here, 'voice', c.file)))
    const delays = voice.clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.start * 1000)}:all=1[a${i}]`)
    const mix = `${voice.clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${voice.clips.length}:normalize=0,` +
      `loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=0:${duration}[aout]`
    audioArgs.push('-filter_complex', [...delays, mix].join(';'), '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000')
  }
  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', ...audioArgs,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((ok, fail) => ffmpeg.on('close', (code) => code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`))))
  const frames = Math.round(duration * FPS)
  for (let i = 0; i < frames; i++) {
    const png = await shot(i / FPS)
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r))
    if (i % 150 === 0) console.log(`frame ${i}/${frames}`)
  }
  ffmpeg.stdin.end()
  await done
  // Poster/thumbnail: the end card.
  await page.evaluate((t) => window.render(t), duration - 0.4)
  await page.screenshot({ path: join(here, 'poster.png') })
  console.log('wrote', out)
}
await browser.close()
