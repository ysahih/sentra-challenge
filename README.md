# Sentra Meeting Intelligence — Build Challenge

A desktop Electron app for meeting transcription and deep research, built with React + TypeScript for the Sentra engineering challenge.

**Cloud or on-device** — transcribe with OpenRouter (GPT-4o) or run **Local Whisper** entirely on your machine. No API key required for private, offline transcription.

## Demo

> Record → Transcribe → Research → Understand

## Features

### Core
- **One-click recording** — single Start/Stop button captures microphone audio
- **Automatic transcription** — **Cloud** (OpenRouter + GPT-4o) or **On-device** (Local Whisper, no API key)
- **Live transcription** — see words appear in real time as you record
- **Speaker detection** — GPT-4o labels speakers, or AssemblyAI for full diarization
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
npm install   # for Local Whisper: install CMake + build tools first (see below)
npm run dev
```

**On-device:** Just start recording — Local Whisper runs entirely on your machine, no API key needed. See [Local Whisper setup](#local-whisper-on-device) below for build prerequisites.

**Cloud:** Go to **Settings** → enter your OpenRouter API key → choose Cloud mode. OpenRouter handles transcription and Claude research chat.

## Local Whisper (On-device)

Local transcription uses `nodejs-whisper`, which compiles native bindings to [whisper.cpp](https://github.com/ggerganov/whisper.cpp). You need **CMake** and a C++ toolchain before `npm install`.

### Prerequisites

**macOS:**
```bash
# Xcode Command Line Tools (includes make, clang)
xcode-select --install

# CMake (via Homebrew)
brew install cmake
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install build-essential cmake
```

**Windows:**
- Install [CMake](https://cmake.org/download/)
- Install [MinGW-w64](https://www.mingw-w64.org/) or [MSYS2](https://www.msys2.org/) (provides `make`, `gcc`)
- Ensure `cmake` and `make` (or `mingw32-make`) are in your PATH

### Install

```bash
npm install
```

The `nodejs-whisper` package will compile during install. If it fails, check that CMake and your build tools are correctly installed.

### Model

The app uses the `base.en` model. It **auto-downloads** on first use (~140MB) to `~/Documents/SentraApp/whisper-models/`. No manual download needed.

### Verifying

In the app, choose **Local Whisper** in the Recorder. If the button is disabled, the native module didn’t build — re-check prerequisites and run `npm install` again.

## Architecture

```
Electron (Main Process)
├── Audio: PCM capture via ScriptProcessorNode → WAV encoding in renderer
├── Transcription: OpenRouter gpt-4o-audio-preview (cloud) OR nodejs-whisper (on-device)
├── Speaker diarization: AssemblyAI (optional)
├── Research: OpenRouter anthropic/claude-sonnet-4-5
├── Meeting Detection: ps aux + desktopCapturer window titles
└── Storage: Local JSON files in ~/Documents/SentraApp/

React (Renderer Process)
├── Recorder — mic capture, WAV encoding, live transcript, meeting banner
├── Research — Claude chat with transcript + KB context
└── Settings — OpenRouter key, AssemblyAI key (optional), KB folder
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
- **Transcription:** Cloud (OpenRouter `gpt-4o-audio-preview`) or **On-device** (`nodejs-whisper`)
- **Research:** OpenRouter `anthropic/claude-sonnet-4-5` (optional)
- **Speaker diarization:** AssemblyAI (optional)
- **Web Audio API** — PCM capture + WAV encoding (no ffmpeg dependency)
- Local JSON storage

## What I'd Build Next

1. ~~Real-time transcription~~ ✓ live stream implemented
2. Google Calendar integration for auto-titling
3. Action item extraction → Linear ticket creation
4. Speaker diarization using a dedicated model (pyannote.audio via Python sidecar)
5. Zoom SDK integration for native participant names