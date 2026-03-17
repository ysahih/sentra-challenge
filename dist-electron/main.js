import { app, ipcMain, dialog, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
promisify(exec);
const require$1 = createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let recordingProcess = null;
let currentRecordingPath = null;
const STORAGE_DIR = path.join(app.getPath("documents"), "SentraApp");
const TRANSCRIPTS_DIR = path.join(STORAGE_DIR, "transcripts");
const KB_DIR = path.join(STORAGE_DIR, "knowledge-base");
function ensureDirectories() {
  [STORAGE_DIR, TRANSCRIPTS_DIR, KB_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.handle("start-recording", async () => {
  var _a;
  try {
    ensureDirectories();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    currentRecordingPath = path.join(STORAGE_DIR, `recording-${timestamp}.wav`);
    recordingProcess = spawn("sox", [
      "-d",
      // default audio device
      "-r",
      "16000",
      // sample rate
      "-c",
      "1",
      // mono
      "-b",
      "16",
      // bit depth
      currentRecordingPath
    ]);
    (_a = recordingProcess.stderr) == null ? void 0 : _a.on("data", (data) => {
      console.log("Recording:", data.toString());
    });
    return { success: true, path: currentRecordingPath };
  } catch (error) {
    console.error("Recording error:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("stop-recording", async () => {
  try {
    if (recordingProcess) {
      recordingProcess.kill("SIGTERM");
      recordingProcess = null;
    }
    return { success: true, path: currentRecordingPath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("transcribe-audio", async (_event, audioPath, apiKey) => {
  try {
    const OpenAI = require$1("openai");
    const openai = new OpenAI({ apiKey });
    const audioFile = fs.createReadStream(audioPath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en"
    });
    ensureDirectories();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const transcriptData = {
      id: Date.now().toString(),
      timestamp,
      audioPath,
      text: transcription.text
    };
    const transcriptPath = path.join(
      TRANSCRIPTS_DIR,
      `transcript-${timestamp.replace(/[:.]/g, "-")}.json`
    );
    fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));
    return { success: true, text: transcription.text, transcriptPath };
  } catch (error) {
    console.error("Transcription error:", error);
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("load-transcripts", async () => {
  try {
    ensureDirectories();
    const files = fs.readdirSync(TRANSCRIPTS_DIR).filter((f) => f.endsWith(".json"));
    const transcripts = files.map((file) => {
      try {
        const content = fs.readFileSync(path.join(TRANSCRIPTS_DIR, file), "utf-8");
        return JSON.parse(content);
      } catch {
        return null;
      }
    }).filter(Boolean).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { success: true, transcripts };
  } catch (error) {
    return { success: false, error: String(error), transcripts: [] };
  }
});
ipcMain.handle("select-kb-folder", async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openDirectory"],
    title: "Select Knowledge Base Folder"
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});
ipcMain.handle("load-kb-files", async (_event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".md") || f.endsWith(".txt")).map((file) => {
      const content = fs.readFileSync(path.join(folderPath, file), "utf-8");
      return { name: file, content };
    });
    return { success: true, files };
  } catch (error) {
    return { success: false, error: String(error), files: [] };
  }
});
ipcMain.handle(
  "claude-chat",
  async (_event, {
    message,
    transcripts,
    kbFiles,
    history,
    apiKey
  }) => {
    try {
      const Anthropic = require$1("@anthropic-ai/sdk");
      const client = new Anthropic.default({ apiKey });
      const transcriptContext = transcripts.length > 0 ? `MEETING TRANSCRIPTS:
${transcripts.slice(0, 5).map((t) => `[${new Date(t.timestamp).toLocaleDateString()}]: ${t.text}`).join("\n\n")}` : "";
      const kbContext = kbFiles.length > 0 ? `KNOWLEDGE BASE:
${kbFiles.slice(0, 3).map((f) => `--- ${f.name} ---
${f.content.slice(0, 1e3)}`).join("\n\n")}` : "";
      const systemPrompt = `You are Sentra, an AI assistant that helps users understand and extract insights from their meeting transcripts and knowledge base documents.

${transcriptContext}

${kbContext}

Answer questions based on the provided context. If the answer isn't in the context, say so clearly. Be concise and helpful.`;
      const messages = [
        ...history.map((h) => ({
          role: h.role,
          content: h.content
        })),
        { role: "user", content: message }
      ];
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1e3,
        system: systemPrompt,
        messages
      });
      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return { success: true, text };
    } catch (error) {
      console.error("Claude error:", error);
      return { success: false, error: String(error) };
    }
  }
);
ipcMain.handle("save-settings", async (_event, settings) => {
  try {
    ensureDirectories();
    fs.writeFileSync(path.join(STORAGE_DIR, "settings.json"), JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
ipcMain.handle("load-settings", async () => {
  try {
    const settingsPath = path.join(STORAGE_DIR, "settings.json");
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      return { success: true, settings };
    }
    return { success: true, settings: {} };
  } catch (error) {
    return { success: false, settings: {} };
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  ensureDirectories();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
