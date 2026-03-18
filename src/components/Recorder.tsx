import { useState, useRef, useEffect } from 'react'
import { AppSettings, Transcript } from '../App'

type RecorderProps = {
  settings: AppSettings
  onTranscriptsUpdate: () => void
  transcripts: Transcript[]
}

export default function Recorder({ settings, onTranscriptsUpdate, transcripts }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [status, setStatus] = useState('')
  const [meetingDetected, setMeetingDetected] = useState<string[]>([])
  const [activeMeetingApp, setActiveMeetingApp] = useState<string | undefined>(undefined)
  const [useLocal, setUseLocal] = useState(false)
  const [whisperAvailable, setWhisperAvailable] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const meetingCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const pcmChunksRef = useRef<Float32Array[]>([])
  const streamChunksRef = useRef<Float32Array[]>([])
  const liveTranscriptRef = useRef<string>('')
  const sampleRateRef = useRef<number>(44100)

  // Check whisper availability on mount
  useEffect(() => {
    window.electron.checkWhisper().then((result) => {
      setWhisperAvailable(result.available)
    })
  }, [])

  // Poll for meeting detection every 5 seconds
  useEffect(() => {
    const checkMeeting = async () => {
      const result = await window.electron.detectMeeting()
      setMeetingDetected(result.apps)
      if (result.apps.length > 0) setActiveMeetingApp(result.apps[0])
    }
    checkMeeting()
    meetingCheckRef.current = setInterval(checkMeeting, 5000)
    return () => { if (meetingCheckRef.current) clearInterval(meetingCheckRef.current) }
  }, [])

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (streamingIntervalRef.current) clearInterval(streamingIntervalRef.current)
      cleanupAudio()
    }
  }, [])

  const cleanupAudio = () => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    processorRef.current?.disconnect()
    audioContextRef.current?.close().catch(() => { })
    micStreamRef.current = null
    processorRef.current = null
    audioContextRef.current = null
  }

  const flattenChunks = (chunks: Float32Array[]) => {
    const total = chunks.reduce((acc, c) => acc + c.length, 0)
    const result = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
    return result
  }

  const resample = (buffer: Float32Array, from: number, to: number) => {
    if (from === to) return buffer
    const ratio = from / to
    const newLength = Math.round(buffer.length / ratio)
    const result = new Float32Array(newLength)
    for (let i = 0; i < newLength; i++) {
      const t = i * ratio
      const i0 = Math.floor(t)
      const i1 = Math.min(buffer.length - 1, i0 + 1)
      result[i] = buffer[i0] + (buffer[i1] - buffer[i0]) * (t - i0)
    }
    return result
  }

  const float32ToInt16 = (buffer: Float32Array) => {
    const buf = new Int16Array(buffer.length)
    for (let i = 0; i < buffer.length; i++) {
      buf[i] = Math.max(-32768, Math.min(32767, Math.round(buffer[i] * 32767)))
    }
    return buf
  }

  const encodeWav = (samples: Int16Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
    }
    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeStr(36, 'data')
    view.setUint32(40, samples.length * 2, true)
    for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true)
    return new Blob([view], { type: 'audio/wav' })
  }

  const buildWavBase64 = (chunks: Float32Array[], sampleRate: number): Promise<string> => {
    return new Promise((resolve) => {
      const full = flattenChunks(chunks)
      const resampled = resample(full, sampleRate, 16000)
      const pcm16 = float32ToInt16(resampled)
      const blob = encodeWav(pcm16, 16000)
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }

  // Stream chunk every 5 seconds during recording
  const startStreamingChunks = () => {
    setIsStreaming(true)
    streamChunksRef.current = []

    streamingIntervalRef.current = setInterval(async () => {
      const chunks = [...streamChunksRef.current]
      streamChunksRef.current = [] // reset for next chunk

      if (chunks.length === 0) return

      try {
        const base64 = await buildWavBase64(chunks, sampleRateRef.current)
        const result = useLocal
          ? await window.electron.transcribeLocal(base64)
          : await window.electron.transcribeChunk(base64, settings.apiKey, false)

        if (result.success && result.text) {
          liveTranscriptRef.current += result.text + ' '
          setLiveTranscript(liveTranscriptRef.current)
        }
      } catch (e) {
        console.error('Chunk transcription error:', e)
      }
    }, 5000)
  }

  const startRecording = async () => {
    if (isRecording || isTranscribing) return
    if (!useLocal && !settings.apiKey) {
      setStatus('⚠️ Please add your OpenRouter API key in Settings first')
      return
    }

    try {
      setStatus('')
      liveTranscriptRef.current = ''
      setLiveTranscript('')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream

      const context = new AudioContext()
      audioContextRef.current = context
      sampleRateRef.current = context.sampleRate
      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      pcmChunksRef.current = []

      processor.onaudioprocess = (e) => {
        const data = new Float32Array(e.inputBuffer.getChannelData(0))
        pcmChunksRef.current.push(data)
        streamChunksRef.current.push(data)
      }

      source.connect(processor)
      processor.connect(context.destination)

      startStreamingChunks()

      setIsRecording(true)
      setElapsed(0)
      setStatus(activeMeetingApp ? `🔴 Recording ${activeMeetingApp} meeting...` : '🔴 Recording...')
      timerIntervalRef.current = setInterval(() => setElapsed((t) => t + 1), 1000)
    } catch (err: unknown) {
      setStatus(`❌ Failed to start: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const stopRecording = async () => {
    if (!isRecording) return
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null }
    if (streamingIntervalRef.current) { clearInterval(streamingIntervalRef.current); streamingIntervalRef.current = null }

    setIsRecording(false)
    setIsStreaming(false)
    setStatus('Processing final audio...')

    const sampleRate = sampleRateRef.current
    const chunks = [...pcmChunksRef.current]
    cleanupAudio()
    pcmChunksRef.current = []

    if (chunks.length === 0) { setStatus('❌ No audio captured.'); return }

    setIsTranscribing(true)

    try {
      // Use accumulated live transcript + final pass
      let finalText = liveTranscriptRef.current.trim()

      if (!finalText) {
        // Fallback: transcribe full recording if streaming got nothing
        setStatus('⏳ Transcribing full recording...')
        const base64 = await buildWavBase64(chunks, sampleRate)

        if (useLocal) {
          const result = await window.electron.transcribeLocal(base64)
          finalText = result.success ? result.text : ''
        } else {
          finalText = await window.electron.transcribeAudio(base64, settings.apiKey, activeMeetingApp)
        }
      }

      if (finalText) {
        await window.electron.saveTranscript(finalText, activeMeetingApp)
        onTranscriptsUpdate()
        setStatus('✅ Transcription complete!')
        setLiveTranscript('')
        liveTranscriptRef.current = ''
      } else {
        setStatus('⚠️ No speech detected.')
      }
    } catch (err: unknown) {
      setStatus(`❌ Transcription failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsTranscribing(false)
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

      {/* Meeting Detection Banner */}
      {meetingDetected.length > 0 && (
        <div className="meeting-banner">
          <span className="meeting-dot"></span>
          <span>{meetingDetected.join(', ')} detected — ready to record</span>
        </div>
      )}

      {/* Transcription Mode Toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${!useLocal ? 'active' : ''}`}
          onClick={() => setUseLocal(false)}
        >
          ☁️ Cloud (OpenRouter)
        </button>
        <button
          className={`mode-btn ${useLocal ? 'active' : ''}`}
          onClick={() => setUseLocal(true)}
          disabled={!whisperAvailable}
          title={!whisperAvailable ? 'Downloads model on first use' : ''}
        >
          💻 Local (Whisper){!whisperAvailable ? ' — click to setup' : ''}
        </button>
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
            {isStreaming && <span className="streaming-label">● Live</span>}
          </div>
        )}

        {status && <div className="status-msg">{status}</div>}

        {/* Live streaming transcript */}
        {liveTranscript && (
          <div className="live-transcript">
            <div className="live-label">🎙 Live transcript</div>
            <p>{liveTranscript}</p>
          </div>
        )}
      </div>

      <div className="transcripts-section">
        <h2>Transcripts ({transcripts.length})</h2>
        {transcripts.length === 0 ? (
          <div className="empty-state">
            <p>No transcripts yet. Start recording to create one.</p>
          </div>
        ) : (
          <div className="transcripts-list">
            {transcripts.map((t) => (
              <div key={t.id} className="transcript-card">
                <div className="transcript-header">
                  <span className="transcript-date">{new Date(t.timestamp).toLocaleString()}</span>
                  {t.meetingApp && <span className="meeting-badge">{t.meetingApp}</span>}
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