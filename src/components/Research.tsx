import { useState, useRef, useEffect } from 'react'
import { Transcript, KbFile, AppSettings } from '../App'

type Props = {
  settings: AppSettings
  transcripts: Transcript[]
  kbFiles: KbFile[]
}

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function Research({ settings, transcripts, kbFiles }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    if (!settings.anthropicKey) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Please add your Anthropic API key in Settings first.' },
      ])
      return
    }

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    const result = await window.electronAPI.claudeChat({
      message: userMessage,
      transcripts: transcripts.map((t) => ({ text: t.text, timestamp: t.timestamp })),
      kbFiles,
      history: messages,
      apiKey: settings.anthropicKey,
    })

    setIsLoading(false)
    if (result.success) {
      setMessages((prev) => [...prev, { role: 'assistant', content: result.text }])
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ Error: ${result.error}` },
      ])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="page research-page">
      <div className="page-header">
        <h1>Deep Research</h1>
        <p>Chat with your transcripts and knowledge base</p>
      </div>

      <div className="context-bar">
        <span>📄 {transcripts.length} transcripts</span>
        <span>📚 {kbFiles.length} KB files</span>
      </div>

      <div className="chat-container">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">🔍</div>
            <h3>Ask anything about your meetings</h3>
            <p>Try: "Summarize my last meeting" or "What decisions were made?"</p>
            <div className="suggestions">
              {[
                'Summarize my recent transcripts',
                'What action items were mentioned?',
                'What topics came up most often?',
              ].map((s) => (
                <button key={s} className="suggestion-btn" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <div className="message-bubble">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-bubble loading">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your meetings... (Enter to send)"
          rows={2}
        />
        <button className="send-btn" onClick={sendMessage} disabled={isLoading || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  )
}
