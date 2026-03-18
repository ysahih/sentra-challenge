"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  getDesktopSources: () => electron.ipcRenderer.invoke("get-desktop-sources"),
  detectMeeting: () => electron.ipcRenderer.invoke("detect-meeting"),
  transcribeAudio: (base64Audio, apiKey, meetingApp) => electron.ipcRenderer.invoke("transcribe-audio", base64Audio, apiKey, meetingApp),
  saveTranscript: (text, meetingApp) => electron.ipcRenderer.invoke("save-transcript", text, meetingApp),
  loadTranscripts: () => electron.ipcRenderer.invoke("load-transcripts"),
  selectKbFolder: () => electron.ipcRenderer.invoke("select-kb-folder"),
  loadKbFiles: (folderPath) => electron.ipcRenderer.invoke("load-kb-files", folderPath),
  claudeChat: (message, transcripts, kbFiles, history, apiKey) => electron.ipcRenderer.invoke("claude-chat", message, transcripts, kbFiles, history, apiKey),
  saveSettings: (settings) => electron.ipcRenderer.invoke("save-settings", settings),
  loadSettings: () => electron.ipcRenderer.invoke("load-settings")
});
