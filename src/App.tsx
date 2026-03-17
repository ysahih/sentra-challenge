import { useState, useEffect } from 'react'
import Recorder from './components/Recorder'
import Research from './components/Research'
import Settings from './components/Settings'
import './App.css'

export type Transcript = {
  id: string
  timestamp: string
  audioPath: string
  text: string
}

export type KbFile = {
  name: string
  content: string
}

export type AppSettings = {
  anthropicKey: string
  openaiKey: string
  kbFolderPath: string
}

function App() {
  const [activeTab, setActiveTab] = useState<'recorder' | 'research' | 'settings'>('recorder')
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [kbFiles, setKbFiles] = useState<KbFile[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    anthropicKey: '',
    openaiKey: '',
    kbFolderPath: '',
  })

  useEffect(() => {
    loadSettings()
    loadTranscripts()
  }, [])

  const loadSettings = async () => {
    const result = await window.electronAPI.loadSettings()
    if (result.success && result.settings) {
      setSettings(result.settings)
      if (result.settings.kbFolderPath) {
        loadKbFiles(result.settings.kbFolderPath)
      }
    }
  }

  const loadTranscripts = async () => {
    const result = await window.electronAPI.loadTranscripts()
    if (result.success) {
      setTranscripts(result.transcripts)
    }
  }

  const loadKbFiles = async (folderPath: string) => {
    const result = await window.electronAPI.loadKbFiles(folderPath)
    if (result.success) {
      setKbFiles(result.files)
    }
  }

  const handleSettingsSave = async (newSettings: AppSettings) => {
    setSettings(newSettings)
    await window.electronAPI.saveSettings(newSettings)
    if (newSettings.kbFolderPath) {
      loadKbFiles(newSettings.kbFolderPath)
    }
  }

  const handleNewTranscript = (transcript: Transcript) => {
    setTranscripts((prev) => [transcript, ...prev])
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
            <span className="nav-icon">🎙️</span>
            <span>Recorder</span>
          </button>
          <button className={`nav-item ${activeTab === 'research' ? 'active' : ''}`} onClick={() => setActiveTab('research')}>
            <span className="nav-icon">🔍</span>
            <span>Research</span>
          </button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="nav-icon">⚙️</span>
            <span>Settings</span>
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
        {activeTab === 'recorder' && <Recorder settings={settings} onNewTranscript={handleNewTranscript} transcripts={transcripts} />}
        {activeTab === 'research' && <Research settings={settings} transcripts={transcripts} kbFiles={kbFiles} />}
        {activeTab === 'settings' && <Settings settings={settings} onSave={handleSettingsSave} />}
      </div>
    </div>
  )
}

export default App