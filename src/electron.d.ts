export {}

declare global {
  interface Window {
    electronAPI: {
      startRecording: () => Promise<{ success: boolean; path?: string; error?: string }>
      stopRecording: () => Promise<{ success: boolean; path?: string; error?: string }>
      transcribeAudio: (path: string, apiKey: string) => Promise<{ success: boolean; text?: string; error?: string }>
      loadTranscripts: () => Promise<{ success: boolean; transcripts: any[] }>
      selectKbFolder: () => Promise<{ success: boolean; path?: string }>
      loadKbFiles: (folderPath: string) => Promise<{ success: boolean; files: any[] }>
      claudeChat: (params: any) => Promise<{ success: boolean; text?: string; error?: string }>
      saveSettings: (settings: any) => Promise<{ success: boolean }>
      loadSettings: () => Promise<{ success: boolean; settings: any }>
    }
  }
}