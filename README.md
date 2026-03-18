# Sentra Meeting Intelligence — Build Challenge

A desktop Electron app for meeting transcription and deep research, built with React + TypeScript for the Sentra engineering challenge.

## Demo

> Record → Transcribe → Research → Understand

## Features

### Core
- **One-click recording** — single Start/Stop button captures microphone audio
- **Automatic transcription** — powered by OpenRouter + GPT-4o Audio Preview
- **Speaker detection** — AI identifies and labels multiple speakers in recordings
- **Deep Research** — Claude-powered chat to query all your transcripts and documents
- **Knowledge Base** — point to any folder of `.md` or `.txt` files as context
- **Auto-save** — all transcripts saved locally to `~/Documents/SentraApp/`

### Bonus
- **Meeting detection** — automatically detects if Zoom, Google Meet, Teams, Webex, or Discord is running and shows a banner
- **Meeting-aware transcription** — labels transcripts with their source app (Zoom, Meet, etc.)

## Quick Start

```bash
git clone <repo>
cd sentra-challenge
npm install
npm run dev
```

Go to **Settings** → enter your OpenRouter API key → start recording.

**OpenRouter API key** handles both transcription and Claude chat in one key.

## Architecture

```
Electron (Main Process)
├── Audio: PCM capture via ScriptProcessorNode → WAV encoding in renderer
├── Transcription: OpenRouter gpt-4o-audio-preview (WAV format)
├── Research: OpenRouter anthropic/claude-sonnet-4-5
├── Meeting Detection: ps aux + desktopCapturer window titles
└── Storage: Local JSON files in ~/Documents/SentraApp/

React (Renderer Process)
├── Recorder — mic capture, WAV encoding, timer, meeting banner
├── Research — Claude chat with transcript + KB context
└── Settings — API key, KB folder selection
```

## Answers to Ashwin's Bonus Questions

### 1. Meeting Detection Directly
**Implemented.** The app polls every 5 seconds using `ps aux` + `desktopCapturer` window titles to detect:
- Zoom (`zoom.us`)
- Google Meet (Chrome window with `meet.google`)
- Microsoft Teams
- Webex
- Discord / Slack

When detected, a green banner appears: *"Zoom detected — ready to record"*. The transcript is then tagged with the meeting source.

### 2. Calendar Integration
**How it could work:**
- OAuth2 with Google Calendar API / Microsoft Graph API
- On app startup, fetch today's upcoming meetings
- Show a "Meeting starting in 5 min" notification → one-click to start recording
- Auto-title transcripts with the calendar event name and participants
- Post-meeting: auto-attach transcript to calendar event as a note

**Implementation path:** `googleapis` npm package + OAuth2 token stored in system keychain via `electron-keytar`.

### 3. Speaker Names (Zoom, Meet, Teams)
**Current:** GPT-4o labels speakers as "Speaker 1", "Speaker 2" from audio alone.

**Better approach with meeting context:**
- **Zoom SDK** / **Google Meet Add-on API** can provide participant lists
- Cross-reference speaker order with participant join times
- For screen-captured meetings: use vision model to read participant names from the UI
- **Zoom's transcription API** provides speaker-labeled transcripts natively — we could consume that directly instead of transcribing ourselves

### 4. Porting to Other Tools
**Slack:** Slash command `/sentra` to pull meeting summaries into channels  
**Notion:** Export transcripts as Notion pages via API  
**Linear/Jira:** Extract action items and auto-create tickets  
**Chrome Extension:** Capture Google Meet audio directly in-browser using `chrome.tabCapture`  
**VS Code Extension:** Query meeting context while coding ("what did we decide about this API?")

The core research engine (Claude + transcript context) is tool-agnostic — it's just an API call. The hard part is audio capture, which differs per platform.

### 5. Real-time Screen Capture / Video Stream
**Current approach limitation:** `ScriptProcessorNode` captures mic only.

**Real-time approach:**
```
desktopCapturer → getDisplayMedia → AudioContext mix → 
chunk every 5s → transcribe incrementally → 
stream to UI in real-time
```

Electron's `desktopCapturer` + `setDisplayMediaRequestHandler` with `audio: 'loopback'` can capture system audio on macOS. The challenge is macOS requires a virtual audio driver (like BlackHole) for true loopback capture.

**For video:** Capture video frames → send to vision model → extract speaker names, screen content, whiteboard notes → enrich transcription with visual context.

## Tech Stack

- **Electron** + **Vite** + **React** + **TypeScript**
- **OpenRouter** (single API key for everything)
  - `openai/gpt-4o-audio-preview` — transcription
  - `anthropic/claude-sonnet-4-5` — research chat
- **Web Audio API** — PCM capture + WAV encoding (no ffmpeg dependency)
- Local JSON storage

## What I'd Build Next

1. Real-time transcription (chunk audio every 10s, stream to UI)
2. Google Calendar integration for auto-titling
3. Action item extraction → Linear ticket creation
4. Speaker diarization using a dedicated model (pyannote.audio via Python sidecar)
5. Zoom SDK integration for native participant names