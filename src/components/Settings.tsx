import { useState } from 'react'
import { AppSettings } from '../App'

type Props = {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

export default function Settings({ settings, onSave }: Props) {
  const [form, setForm] = useState<AppSettings>(settings)
  const [saved, setSaved] = useState(false)
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null)

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const selectKbFolder = async () => {
    const result = await window.electron.selectKbFolder()
    if (result) setForm((prev) => ({ ...prev, kbFolderPath: result }))
  }

  const checkWhisper = async () => {
    const result = await window.electron.checkWhisper()
    setWhisperAvailable(result?.available ?? false)
  }

  const setMode = (local: boolean) => {
    setForm((prev) => ({ ...prev, useLocalWhisper: local }))
    if (local && whisperAvailable === null) checkWhisper()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure your API keys and knowledge base</p>
      </div>

      <div className="settings-form">

        {/* Transcription Mode */}
        <div className="setting-group">
          <h3>⚡ Transcription Mode</h3>
          <p className="setting-desc">On-device runs entirely locally — no API key needed</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              className="folder-btn"
              onClick={() => setMode(false)}
              style={{
                flex: 1,
                background: !form.useLocalWhisper ? '#6366f1' : undefined,
                color: !form.useLocalWhisper ? '#fff' : undefined,
              }}
            >
              ☁️ Cloud (OpenRouter)
            </button>
            <button
              className="folder-btn"
              onClick={() => setMode(true)}
              style={{
                flex: 1,
                background: form.useLocalWhisper ? '#6366f1' : undefined,
                color: form.useLocalWhisper ? '#fff' : undefined,
              }}
            >
              🖥️ On-device (Whisper)
            </button>
          </div>
          {form.useLocalWhisper && (
            <p className="setting-desc" style={{ marginTop: '8px' }}>
              {whisperAvailable === null && '⏳ Checking Whisper...'}
              {whisperAvailable === true && '✅ Whisper is ready'}
              {whisperAvailable === false && '⚠️ Whisper not found — run npm install first'}
            </p>
          )}
        </div>

        {/* OpenRouter API Key — hide if local mode */}
        {!form.useLocalWhisper && (
          <div className="setting-group">
            <h3>🔑 OpenRouter API Key</h3>
            <p className="setting-desc">Used for cloud transcription and Claude research chat</p>
            <input
              type="password"
              className="setting-input"
              placeholder="sk-or-v1-..."
              value={form.apiKey}
              onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            />
          </div>
        )}

        {/* AssemblyAI */}
        <div className="setting-group">
          <h3>🎤 AssemblyAI API Key</h3>
          <p className="setting-desc">Used for speaker diarization — who said what</p>
          <input
            type="password"
            className="setting-input"
            placeholder="assemblyai key..."
            value={form.assemblyKey}
            onChange={(e) => setForm((prev) => ({ ...prev, assemblyKey: e.target.value }))}
          />
          <p className="setting-desc" style={{ marginTop: '6px' }}>
            Free tier at{' '}
            <a href="https://assemblyai.com" target="_blank" style={{ color: '#6366f1' }}>
              assemblyai.com
            </a>{' '}
            — 100 hours/month
          </p>
        </div>

        {/* Knowledge Base */}
        <div className="setting-group">
          <h3>📚 Knowledge Base Folder</h3>
          <p className="setting-desc">Point to a folder of .md or .txt files</p>
          <div className="folder-input">
            <input
              type="text"
              className="setting-input"
              placeholder="No folder selected"
              value={form.kbFolderPath}
              readOnly
            />
            <button className="folder-btn" onClick={selectKbFolder}>Browse</button>
          </div>
        </div>

        <button className="save-btn" onClick={handleSave}>
          {saved ? '✅ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}