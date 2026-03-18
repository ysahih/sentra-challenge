import { app, BrowserWindow, ipcMain, dialog, systemPreferences, session, desktopCapturer } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

const STORAGE_DIR = path.join(app.getPath('documents'), 'SentraApp')
const TRANSCRIPTS_DIR = path.join(STORAGE_DIR, 'transcripts')
const SETTINGS_PATH = path.join(STORAGE_DIR, 'settings.json')
const WHISPER_MODELS_DIR = path.join(STORAGE_DIR, 'whisper-models')

function ensureDirectories() {
  ;[STORAGE_DIR, TRANSCRIPTS_DIR, WHISPER_MODELS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })

  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' })
    }).catch(() => { callback({} as any) })
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ─── Desktop Sources ──────────────────────────────────────────────────────────

ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 0, height: 0 },
  })
  return sources.map((s) => ({ id: s.id, name: s.name }))
})

// ─── Meeting Detection ────────────────────────────────────────────────────────

ipcMain.handle('detect-meeting', async () => {
  try {
    const { stdout } = await execAsync('ps aux')
    const processes = stdout.toLowerCase()
    const meetingApps = [
      { name: 'Zoom', keywords: ['zoom.us', 'zoom meeting'] },
      { name: 'Google Meet', keywords: ['meet.google', 'google meet'] },
      { name: 'Microsoft Teams', keywords: ['teams', 'msteams'] },
      { name: 'Webex', keywords: ['webex', 'ciscowebex'] },
      { name: 'Discord', keywords: ['discord'] },
      { name: 'Slack', keywords: ['slack'] },
    ]
    const detected = meetingApps.filter((a) => a.keywords.some((kw) => processes.includes(kw)))
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } })
    const titles = sources.map((s) => s.name.toLowerCase())
    if (titles.some((t) => t.includes('zoom')) && !detected.find((d) => d.name === 'Zoom')) detected.push({ name: 'Zoom', keywords: [] })
    if (titles.some((t) => t.includes('google meet')) && !detected.find((d) => d.name === 'Google Meet')) detected.push({ name: 'Google Meet', keywords: [] })
    if (titles.some((t) => t.includes('microsoft teams')) && !detected.find((d) => d.name === 'Microsoft Teams')) detected.push({ name: 'Microsoft Teams', keywords: [] })
    return { isInMeeting: detected.length > 0, apps: detected.map((d) => d.name) }
  } catch { return { isInMeeting: false, apps: [] } }
})

// ─── Local Whisper Transcription ──────────────────────────────────────────────

ipcMain.handle('check-whisper', async () => {
  try {
    const { nodewhisper } = await import('nodejs-whisper')
    return { available: true }
  } catch {
    return { available: false }
  }
})

ipcMain.handle('transcribe-local', async (_event, base64Audio: string) => {
  try {
    const audioData = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio
    const audioBuffer = Buffer.from(audioData, 'base64')

    // Save WAV temporarily
    const tmpPath = path.join(STORAGE_DIR, `tmp_${Date.now()}.wav`)
    fs.writeFileSync(tmpPath, audioBuffer)

    const { nodewhisper } = await import('nodejs-whisper')
    const result = await nodewhisper(tmpPath, {
      modelName: 'base.en',
      autoDownloadModelName: 'base.en',
      whisperOptions: {
        outputInText: true,
        translateToEnglish: false,
        wordTimestamps: false,
      },
    })

    // Cleanup temp file
    fs.unlinkSync(tmpPath)

    const text = typeof result === 'string' ? result : result?.map((r: any) => r.speech).join(' ')
    return { success: true, text: text?.trim() || '' }
  } catch (error) {
    console.error('Local whisper error:', error)
    return { success: false, error: String(error) }
  }
})

// ─── OpenRouter Transcription (fallback) ─────────────────────────────────────

ipcMain.handle('transcribe-audio', async (_event, base64Audio: string, apiKey: string, meetingApp?: string) => {
  try {
    const audioData = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio
    console.log('Using API key:', apiKey ? apiKey.substring(0, 20) + '...' : 'EMPTY')

    const speakerPrompt = meetingApp
      ? `Transcribe this audio from a ${meetingApp} meeting. Label different speakers as "Speaker 1:", "Speaker 2:", etc. Return only the transcription.`
      : 'Transcribe this audio. If multiple speakers, label them as "Speaker 1:", "Speaker 2:", etc. Return only the transcription.'

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentra.app',
        'X-Title': 'Sentra Meeting Intelligence',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-audio-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: audioData, format: 'wav' } },
            { type: 'text', text: speakerPrompt },
          ],
        }],
      }),
    })

    const rawText = await response.text()
    console.log('Transcription status:', response.status)
    if (!response.ok) throw new Error(`API error ${response.status}: ${rawText.substring(0, 300)}`)
    const data = JSON.parse(rawText)
    if (data.error) throw new Error(JSON.stringify(data.error))
    return data.choices?.[0]?.message?.content?.trim() || ''
  } catch (error) {
    console.error('Transcription error:', error)
    throw error
  }
})

// ─── Streaming chunk transcription ───────────────────────────────────────────
// Called every 5s with a chunk — sends result back via IPC event

ipcMain.handle('transcribe-chunk', async (_event, base64Audio: string, apiKey: string, useLocal: boolean) => {
  try {
    if (useLocal) {
      const result = await new Promise<{ success: boolean; text: string; error?: string }>((resolve) => {
        ipcMain.emit('transcribe-local', { sender: { send: () => {} } }, base64Audio)
        resolve({ success: true, text: '' })
      })
      return result
    }

    // Use OpenRouter for chunk
    const audioData = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentra.app',
        'X-Title': 'Sentra Meeting Intelligence',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-audio-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: audioData, format: 'wav' } },
            { type: 'text', text: 'Transcribe this audio chunk exactly. Return only the words spoken, nothing else.' },
          ],
        }],
      }),
    })

    if (!response.ok) return { success: false, text: '', error: `${response.status}` }
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content?.trim() || ''
    return { success: true, text }
  } catch (error) {
    return { success: false, text: '', error: String(error) }
  }
})

// ─── Save Transcript ──────────────────────────────────────────────────────────

ipcMain.handle('save-transcript', async (_event, text: string, meetingApp?: string) => {
  try {
    ensureDirectories()
    const timestamp = new Date().toISOString()
    const data = { id: Date.now().toString(), timestamp, text: String(text), meetingApp: meetingApp || null }
    const filename = `transcript_${timestamp.replace(/[:.]/g, '-')}.json`
    fs.writeFileSync(path.join(TRANSCRIPTS_DIR, filename), JSON.stringify(data, null, 2))
    return true
  } catch { return false }
})

// ─── Load Transcripts ─────────────────────────────────────────────────────────

ipcMain.handle('load-transcripts', async () => {
  try {
    ensureDirectories()
    const files = fs.readdirSync(TRANSCRIPTS_DIR).filter((f) => f.endsWith('.json'))
    return files
      .map((file) => {
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(TRANSCRIPTS_DIR, file), 'utf-8'))
          return {
            id: String(parsed.id || Date.now()),
            timestamp: String(parsed.timestamp || new Date().toISOString()),
            text: typeof parsed.text === 'string' ? parsed.text : String(parsed.text),
            meetingApp: parsed.meetingApp || null,
          }
        } catch { return null }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime())
  } catch { return [] }
})

// ─── Knowledge Base ───────────────────────────────────────────────────────────

ipcMain.handle('select-kb-folder', async () => {
  const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'], title: 'Select Knowledge Base Folder' })
  return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null
})

ipcMain.handle('load-kb-files', async (_event, folderPath: string) => {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) return []
    return fs.readdirSync(folderPath)
      .filter((f) => f.endsWith('.md') || f.endsWith('.txt'))
      .map((file) => ({ name: file, content: fs.readFileSync(path.join(folderPath, file), 'utf-8') }))
  } catch { return [] }
})

// ─── Claude Chat ──────────────────────────────────────────────────────────────

ipcMain.handle('claude-chat', async (_event,
  message: string,
  transcripts: Array<{ text: string; timestamp: string; meetingApp?: string }>,
  kbFiles: Array<{ name: string; content: string }>,
  history: Array<{ role: string; content: string }>,
  apiKey: string,
) => {
  try {
    let context = ''
    if (transcripts.length > 0) {
      context += 'MEETING TRANSCRIPTS:\n\n'
      transcripts.slice(0, 10).forEach((t) => {
        const source = t.meetingApp ? ` (via ${t.meetingApp})` : ''
        context += `[${new Date(t.timestamp).toLocaleString()}${source}]\n${t.text}\n\n`
      })
    }
    if (kbFiles.length > 0) {
      context += 'KNOWLEDGE BASE:\n\n'
      kbFiles.forEach((kb) => { context += `--- ${kb.name} ---\n${kb.content.slice(0, 2000)}\n\n` })
    }

    const systemPrompt = `You are Sentra, an AI assistant that helps users understand their meeting transcripts and knowledge base. Be concise and helpful.${context ? `\n\nContext:\n${context}` : ''}`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentra.app',
        'X-Title': 'Sentra Meeting Intelligence',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }],
      }),
    })

    const data = await response.json()
    if (data.error) throw new Error(JSON.stringify(data.error))
    return data.choices?.[0]?.message?.content || 'No response'
  } catch (error) {
    console.error('Claude chat error:', error)
    throw error
  }
})

// ─── Settings ─────────────────────────────────────────────────────────────────

ipcMain.handle('save-settings', async (_event, settings: Record<string, string>) => {
  try { ensureDirectories(); fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2)); return true }
  catch { return false }
})

ipcMain.handle('load-settings', async () => {
  const defaults = { apiKey: '', kbFolderPath: '', useLocalWhisper: 'false' }
  try {
    if (fs.existsSync(SETTINGS_PATH)) return { ...defaults, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) }
  } catch {}
  return defaults
})

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit(); win = null } })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.whenReady().then(async () => {
  ensureDirectories()
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status !== 'granted') await systemPreferences.askForMediaAccess('microphone')
  }
  createWindow()
})