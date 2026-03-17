import { useState, useEffect, useRef } from 'react'
import { Transcript, AppSettings } from '../App'

type Props = {
  settings: AppSettings
  onNewTranscript: (transcript: Transcript) => void
  transcripts: Transcript[]
}

export default function Recorder({ settings, onNewTranscript, transcripts }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [status, setStatus] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startRecording = async () => {
    if (!settings.openaiKey) {
      setStatus('⚠️ Please add your OpenAI API key in Settings first')
      return
    }
    const result = await window.electronAPI.startRecording()
    if (result.success) {
      setIsRecording(true)
      setElapsed(0)
      setStatus('🔴 Recording...')
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      setStatus(`❌ Failed to start: ${result.error}`)
    }
  }

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    const result = await window.electronAPI.stopRecording()
    setIsRecording(false)
    if (result.success && result.path) {
      setStatus('⏳ Transcribing...')
      setIsTranscribing(true)
      const tResult = await window.electronAPI.transcribeAudio(result.path, settings.openaiKey)
      setIsTranscribing(false)
      if (tResult.success) {
        setStatus('✅ Transcription complete!')
        onNewTranscript({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          audioPath: result.path,
          text: tResult.text,
        })
      } else {
        setStatus(`❌ Transcription failed: ${tResult.error}`)
      }
    }
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="page">
      <div className="page-header">
        <h1>Meeting Recorder</h1>
        <p>Record and transcribe your meetings automatically</p>
      </div>
      <div className="record-section">
        <button
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
        >
          <span className="record-icon">{isRecording ? '⏹' : '🎙️'}</span>
          <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
        </button>
        {isRecording && (
          <div className="recording-indicator">
            <span className="pulse-dot"></span>
            <span>{formatTime(elapsed)}</span>
          </div>
        )}
        {status && <div className="status-msg">{status}</div>}
      </div>
      <div className="transcripts-section">
        <h2>Transcripts ({transcripts.length})</h2>
        {transcripts.length === 0 ? (
          <div className="empty-state"><p>No transcripts yet. Start recording to create one.</p></div>
        ) : (
          <div className="transcripts-list">
            {transcripts.map((t) => (
              <div key={t.id} className="transcript-card">
                <div className="transcript-header">
                  <span className="transcript-date">{new Date(t.timestamp).toLocaleString()}</span>
                </div>
                <p className="transcript-text">{t.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
