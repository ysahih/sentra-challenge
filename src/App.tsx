import { useState, useEffect, useCallback } from 'react'
import Recorder from './components/Recorder'
import Research from './components/Research'
import Settings from './components/Settings'
import './App.css'

const THEME_STORAGE_KEY = 'sentra-theme'

function getStoredTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  return 'dark'
}

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
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme)
  const [activeTab, setActiveTab] = useState<'recorder' | 'research' | 'settings'>('recorder')
  const [transcripts, setTranscripts] = useState<Transcript[]>([])
  const [kbFiles, setKbFiles] = useState<KbFile[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: '',
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {}
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

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
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">S</div>
          <span className="logo-text">Sentra</span>
        </div>
        <nav className="nav">
          <div className="nav-section">
            <div className="nav-section-header">Personal</div>
            <button className={`nav-item ${activeTab === 'recorder' ? 'active' : ''}`} onClick={() => setActiveTab('recorder')}>
              <span className="nav-icon">🎙️</span><span>Recorder</span>
            </button>
            <button className={`nav-item ${activeTab === 'research' ? 'active' : ''}`} onClick={() => setActiveTab('research')}>
              <span className="nav-icon">🔍</span><span>Research</span>
            </button>
          </div>
          <div className="nav-section">
            <div className="nav-section-header">Workspace</div>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <span className="nav-icon">⚙️</span><span>Settings</span>
            </button>
          </div>
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <div className="kb-status">
            <span className="dot" style={{ background: kbFiles.length > 0 ? 'var(--status-green)' : 'var(--fg-muted)' }}></span>
            <span>{kbFiles.length} KB files</span>
          </div>
          <div className="transcript-count">
            <span className="dot" style={{ background: transcripts.length > 0 ? 'var(--status-blue)' : 'var(--fg-muted)' }}></span>
            <span>{transcripts.length} transcripts</span>
          </div>
        </div>
      </aside>
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