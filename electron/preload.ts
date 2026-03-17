import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Recording
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),

  // Transcription
  transcribeAudio: (audioPath: string, apiKey: string) =>
    ipcRenderer.invoke('transcribe-audio', audioPath, apiKey),

  // Transcripts
  loadTranscripts: () => ipcRenderer.invoke('load-transcripts'),

  // Knowledge Base
  selectKbFolder: () => ipcRenderer.invoke('select-kb-folder'),
  loadKbFiles: (folderPath: string) => ipcRenderer.invoke('load-kb-files', folderPath),

  // Claude Chat
  claudeChat: (params: {
    message: string
    transcripts: Array<{ text: string; timestamp: string }>
    kbFiles: Array<{ name: string; content: string }>
    history: Array<{ role: string; content: string }>
    apiKey: string
  }) => ipcRenderer.invoke('claude-chat', params),

  // Settings
  saveSettings: (settings: Record<string, string>) =>
    ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
})