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
      diarizeAudio: (base64Audio: string, assemblyKey: string) => Promise<{ success: boolean; text: string; utterances?: Array<{ speaker: string; text: string; start: number; end: number }>; error?: string }>
      saveTranscript: (text: string, meetingApp?: string, utterances?: any[]) => Promise<boolean>
      loadTranscripts: () => Promise<Array<{ id: string; timestamp: string; text: string; meetingApp?: string; utterances?: any[] }>>
      selectKbFolder: () => Promise<string | null>
      loadKbFiles: (folderPath: string) => Promise<Array<{ name: string; content: string }>>
      claudeChat: (message: string, transcripts: any[], kbFiles: any[], history: any[], apiKey: string) => Promise<string>
      saveSettings: (settings: Record<string, string>) => Promise<boolean>
      loadSettings: () => Promise<Record<string, string>>
    }
  }
}