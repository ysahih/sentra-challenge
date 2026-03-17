"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Recording
  startRecording: () => electron.ipcRenderer.invoke("start-recording"),
  stopRecording: () => electron.ipcRenderer.invoke("stop-recording"),
  // Transcription
  transcribeAudio: (audioPath, apiKey) => electron.ipcRenderer.invoke("transcribe-audio", audioPath, apiKey),
  // Transcripts
  loadTranscripts: () => electron.ipcRenderer.invoke("load-transcripts"),
  // Knowledge Base
  selectKbFolder: () => electron.ipcRenderer.invoke("select-kb-folder"),
  loadKbFiles: (folderPath) => electron.ipcRenderer.invoke("load-kb-files", folderPath),
  // Claude Chat
  claudeChat: (params) => electron.ipcRenderer.invoke("claude-chat", params),
  // Settings
  saveSettings: (settings) => electron.ipcRenderer.invoke("save-settings", settings),
  loadSettings: () => electron.ipcRenderer.invoke("load-settings")
});
