import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  detectMeeting: () => ipcRenderer.invoke('detect-meeting'),
  checkWhisper: () => ipcRenderer.invoke('check-whisper'),
  transcribeLocal: (base64Audio: string) => ipcRenderer.invoke('transcribe-local', base64Audio),
  transcribeAudio: (base64Audio: string, apiKey: string, meetingApp?: string) =>
    ipcRenderer.invoke('transcribe-audio', base64Audio, apiKey, meetingApp),
  transcribeChunk: (base64Audio: string, apiKey: string, useLocal: boolean) =>
    ipcRenderer.invoke('transcribe-chunk', base64Audio, apiKey, useLocal),
  saveTranscript: (text: string, meetingApp?: string) =>
    ipcRenderer.invoke('save-transcript', text, meetingApp),
  loadTranscripts: () => ipcRenderer.invoke('load-transcripts'),
  selectKbFolder: () => ipcRenderer.invoke('select-kb-folder'),
  loadKbFiles: (folderPath: string) => ipcRenderer.invoke('load-kb-files', folderPath),
  claudeChat: (
    message: string,
    transcripts: any[],
    kbFiles: any[],
    history: any[],
    apiKey: string,
  ) => ipcRenderer.invoke('claude-chat', message, transcripts, kbFiles, history, apiKey),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
})