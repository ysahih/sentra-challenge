import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
let recordingProcess: ReturnType<typeof spawn> | null = null
let currentRecordingPath: string | null = null

// Storage directories
const STORAGE_DIR = path.join(app.getPath('documents'), 'SentraApp')
const TRANSCRIPTS_DIR = path.join(STORAGE_DIR, 'transcripts')
const KB_DIR = path.join(STORAGE_DIR, 'knowledge-base')

function ensureDirectories() {
  ;[STORAGE_DIR, TRANSCRIPTS_DIR, KB_DIR].forEach((dir) => {
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
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ─── IPC: Audio Recording ────────────────────────────────────────────────────

ipcMain.handle('start-recording', async () => {
  try {
    ensureDirectories()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    currentRecordingPath = path.join(STORAGE_DIR, `recording-${timestamp}.wav`)

    // Use sox or ffmpeg to record audio
    // sox -d -r 16000 -c 1 output.wav
    recordingProcess = spawn('sox', [
      '-d', // default audio device
      '-r', '16000', // sample rate
      '-c', '1', // mono
      '-b', '16', // bit depth
      currentRecordingPath,
    ])

    recordingProcess.stderr?.on('data', (data) => {
      console.log('Recording:', data.toString())
    })

    return { success: true, path: currentRecordingPath }
  } catch (error) {
    console.error('Recording error:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('stop-recording', async () => {
  try {
    if (recordingProcess) {
      recordingProcess.kill('SIGTERM')
      recordingProcess = null
    }
    return { success: true, path: currentRecordingPath }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// ─── IPC: Transcription ──────────────────────────────────────────────────────

ipcMain.handle('transcribe-audio', async (_event, audioPath: string, apiKey: string) => {
  try {
    const OpenAI = require('openai')
    const openai = new OpenAI({ apiKey })

    const audioFile = fs.createReadStream(audioPath)
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    })

    // Save transcript
    ensureDirectories()
    const timestamp = new Date().toISOString()
    const transcriptData = {
      id: Date.now().toString(),
      timestamp,
      audioPath,
      text: transcription.text,
    }

    const transcriptPath = path.join(
      TRANSCRIPTS_DIR,
      `transcript-${timestamp.replace(/[:.]/g, '-')}.json`,
    )
    fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2))

    return { success: true, text: transcription.text, transcriptPath }
  } catch (error) {
    console.error('Transcription error:', error)
    return { success: false, error: String(error) }
  }
})

// ─── IPC: Load Transcripts ───────────────────────────────────────────────────

ipcMain.handle('load-transcripts', async () => {
  try {
    ensureDirectories()
    const files = fs.readdirSync(TRANSCRIPTS_DIR).filter((f) => f.endsWith('.json'))
    const transcripts = files
      .map((file) => {
        try {
          const content = fs.readFileSync(path.join(TRANSCRIPTS_DIR, file), 'utf-8')
          return JSON.parse(content)
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return { success: true, transcripts }
  } catch (error) {
    return { success: false, error: String(error), transcripts: [] }
  }
})

// ─── IPC: Knowledge Base ─────────────────────────────────────────────────────

ipcMain.handle('select-kb-folder', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
    title: 'Select Knowledge Base Folder',
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] }
  }
  return { success: false }
})

ipcMain.handle('load-kb-files', async (_event, folderPath: string) => {
  try {
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => f.endsWith('.md') || f.endsWith('.txt'))
      .map((file) => {
        const content = fs.readFileSync(path.join(folderPath, file), 'utf-8')
        return { name: file, content }
      })
    return { success: true, files }
  } catch (error) {
    return { success: false, error: String(error), files: [] }
  }
})

// ─── IPC: Claude Chat ────────────────────────────────────────────────────────

ipcMain.handle(
  'claude-chat',
  async (
    _event,
    {
      message,
      transcripts,
      kbFiles,
      history,
      apiKey,
    }: {
      message: string
      transcripts: Array<{ text: string; timestamp: string }>
      kbFiles: Array<{ name: string; content: string }>
      history: Array<{ role: string; content: string }>
      apiKey: string
    },
  ) => {
    try {
      const Anthropic = require('@anthropic-ai/sdk')
      const client = new Anthropic.default({ apiKey })

      // Build context from transcripts and KB
      const transcriptContext =
        transcripts.length > 0
          ? `MEETING TRANSCRIPTS:\n${transcripts
              .slice(0, 5)
              .map((t) => `[${new Date(t.timestamp).toLocaleDateString()}]: ${t.text}`)
              .join('\n\n')}`
          : ''

      const kbContext =
        kbFiles.length > 0
          ? `KNOWLEDGE BASE:\n${kbFiles
              .slice(0, 3)
              .map((f) => `--- ${f.name} ---\n${f.content.slice(0, 1000)}`)
              .join('\n\n')}`
          : ''

      const systemPrompt = `You are Sentra, an AI assistant that helps users understand and extract insights from their meeting transcripts and knowledge base documents.

${transcriptContext}

${kbContext}

Answer questions based on the provided context. If the answer isn't in the context, say so clearly. Be concise and helpful.`

      const messages = [
        ...history.map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user' as const, content: message },
      ]

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      return { success: true, text }
    } catch (error) {
      console.error('Claude error:', error)
      return { success: false, error: String(error) }
    }
  },
)

// ─── IPC: Settings ───────────────────────────────────────────────────────────

ipcMain.handle('save-settings', async (_event, settings: Record<string, string>) => {
  try {
    ensureDirectories()
    fs.writeFileSync(path.join(STORAGE_DIR, 'settings.json'), JSON.stringify(settings, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('load-settings', async () => {
  try {
    const settingsPath = path.join(STORAGE_DIR, 'settings.json')
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      return { success: true, settings }
    }
    return { success: true, settings: {} }
  } catch (error) {
    return { success: false, settings: {} }
  }
})

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ensureDirectories()
  createWindow()
})