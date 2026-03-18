import { useState, useEffect, useCallback } from 'react'
import Recorder from './components/Recorder'
import Research from './components/Research'
import Settings from './components/Settings'
import './App.css'

export type Transcript = {
  id: string
  timestamp: string
  text: string
}

export type KbFile = {
  name: string
  content: string
}

export type AppSettings = {
  apiKey: string
  kbFolderPath: string
}

function App() {
  const [activeTab, setActiveTab] = useState<'recorder' | 'research' | 'settings'>('recorder')
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [kbFiles, setKbFiles] = useState<KbFile[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: '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',
    kbFolderPath: '',
  })

  const loadTranscripts = useCallback(async () => {
    const result = await window.electron.loadTranscripts()
    if (Array.isArray(result)) setTranscripts(result)
  }, [])

  const loadSettings = useCallback(async () => {
    const result = await window.electron.loadSettings()
    if (result && result.apiKey) {
      setSettings(result as AppSettings)
      if (result.kbFolderPath) {
        const files = await window.electron.loadKbFiles(result.kbFolderPath)
        if (Array.isArray(files)) setKbFiles(files)
      }
    }
  }, [])

  useEffect(() => {
    loadSettings()
    loadTranscripts()
  }, [loadSettings, loadTranscripts])

  const handleSettingsSave = async (newSettings: AppSettings) => {
    setSettings(newSettings)
    await window.electron.saveSettings(newSettings as any)
    if (newSettings.kbFolderPath) {
      const files = await window.electron.loadKbFiles(newSettings.kbFolderPath)
      if (Array.isArray(files)) setKbFiles(files)
    }
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="logo">
          <div className="logo-icon">S</div>
          <span className="logo-text">Sentra</span>
        </div>
        <nav className="nav">
          <button className={`nav-item ${activeTab === 'recorder' ? 'active' : ''}`} onClick={() => setActiveTab('recorder')}>
            <span className="nav-icon">🎙️</span><span>Recorder</span>
          </button>
          <button className={`nav-item ${activeTab === 'research' ? 'active' : ''}`} onClick={() => setActiveTab('research')}>
            <span className="nav-icon">🔍</span><span>Research</span>
          </button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="nav-icon">⚙️</span><span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="kb-status">
            <span className="dot" style={{ background: kbFiles.length > 0 ? '#22c55e' : '#6b7280' }}></span>
            <span>{kbFiles.length} KB files</span>
          </div>
          <div className="transcript-count">
            <span className="dot" style={{ background: transcripts.length > 0 ? '#3b82f6' : '#6b7280' }}></span>
            <span>{transcripts.length} transcripts</span>
          </div>
        </div>
      </div>
      <div className="main">
        {activeTab === 'recorder' && (
          <Recorder settings={settings} onTranscriptsUpdate={loadTranscripts} transcripts={transcripts} />
        )}
        {activeTab === 'research' && (
          <Research settings={settings} transcripts={transcripts} kbFiles={kbFiles} />
        )}
        {activeTab === 'settings' && (
          <Settings settings={settings} onSave={handleSettingsSave} />
        )}
      </div>
    </div>
  )
}

export default App