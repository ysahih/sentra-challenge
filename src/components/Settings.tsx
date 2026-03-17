import { useState } from 'react'
import { AppSettings } from '../App'

type Props = {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

export default function Settings({ settings, onSave }: Props) {
  const [form, setForm] = useState<AppSettings>(settings)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const selectKbFolder = async () => {
    const result = await window.electronAPI.selectKbFolder()
    if (result.success) {
      setForm((prev) => ({ ...prev, kbFolderPath: result.path }))
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Configure your API keys and knowledge base</p>
      </div>

      <div className="settings-form">
        <div className="setting-group">
          <h3>🤖 Anthropic (Claude)</h3>
          <p className="setting-desc">Used for the Deep Research chat module</p>
          <input
            type="password"
            className="setting-input"
            placeholder="sk-ant-..."
            value={form.anthropicKey}
            onChange={(e) => setForm((prev) => ({ ...prev, anthropicKey: e.target.value }))}
          />
        </div>

        <div className="setting-group">
          <h3>🎙️ OpenAI (Whisper)</h3>
          <p className="setting-desc">Used for audio transcription</p>
          <input
            type="password"
            className="setting-input"
            placeholder="sk-..."
            value={form.openaiKey}
            onChange={(e) => setForm((prev) => ({ ...prev, openaiKey: e.target.value }))}
          />
        </div>

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
            <button className="folder-btn" onClick={selectKbFolder}>
              Browse
            </button>
          </div>
        </div>

        <button className="save-btn" onClick={handleSave}>
          {saved ? '✅ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
