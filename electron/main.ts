import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { loadPresets, savePresets, loadScheduledTasks, saveScheduledTasks, closeDb } from "./db";
import { BotRunner } from "./bot-runner";

let botRunner: BotRunner | null = null;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#e2e8f0",
      symbolColor: "#334155",
      height: 36,
    },
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  botRunner = new BotRunner(win);
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.appointmentbot.app");

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  setupIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  botRunner?.stop();
  closeDb();
  if (process.platform !== "darwin") app.quit();
});

function setupIpcHandlers(): void {
  // Presets
  ipcMain.handle("presets:load", () => loadPresets());
  ipcMain.handle("presets:save", (_, presets) => { savePresets(presets); return true; });

  // Scheduled tasks
  ipcMain.handle("schedule:load", () => loadScheduledTasks());
  ipcMain.handle("schedule:save", (_, tasks) => { saveScheduledTasks(tasks); return true; });

  // Title bar theme
  ipcMain.handle("titlebar:theme", (_, theme: "dark" | "light") => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (theme === "light") {
      win.setTitleBarOverlay({ color: "#e2e8f0", symbolColor: "#334155", height: 36 });
    } else {
      win.setTitleBarOverlay({ color: "#0f172a", symbolColor: "#94a3b8", height: 36 });
    }
  });

  // Bot control
  ipcMain.handle("bot:start", (_, config) => botRunner?.start(config));
  ipcMain.handle("bot:stop", () => botRunner?.stop());
  ipcMain.handle("bot:validate-token", (_, token) => botRunner?.validateToken(token));
}
