export {}

declare global {
  interface Window {
    electron: {
      getDesktopSources: () => Promise<Array<{ id: string; name: string }>>
      detectMeeting: () => Promise<{ isInMeeting: boolean; apps: string[] }>
      checkWhisper: () => Promise<{ available: boolean }>
      transcribeLocal: (base64Audio: string) => Promise<{ success: boolean; text: string; error?: string }>
      transcribeAudio: (base64Audio: string, apiKey: string, meetingApp?: string) => Promise<string>
      transcribeChunk: (base64Audio: string, apiKey: string, useLocal: boolean) => Promise<{ success: boolean; text: string; error?: string }>
      saveTranscript: (text: string, meetingApp?: string) => Promise<boolean>
      loadTranscripts: () => Promise<Array<{ id: string; timestamp: string; text: string; meetingApp?: string }>>
      selectKbFolder: () => Promise<string | null>
      loadKbFiles: (folderPath: string) => Promise<Array<{ name: string; content: string }>>
      claudeChat: (
        message: string,
        transcripts: Array<{ text: string; timestamp: string; meetingApp?: string }>,
        kbFiles: Array<{ name: string; content: string }>,
        history: Array<{ role: string; content: string }>,
        apiKey: string,
      ) => Promise<string>
      saveSettings: (settings: Record<string, string>) => Promise<boolean>
      loadSettings: () => Promise<Record<string, string>>
    }
  }
}