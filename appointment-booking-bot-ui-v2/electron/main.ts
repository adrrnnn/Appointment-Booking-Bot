import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
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

  let forceClose = false;

  win.on("close", async (e) => {
    if (forceClose) return;
    e.preventDefault();

    const botRunning = botRunner?.hasAnyRunning() ?? false;
    const message = botRunning
      ? "A bot is currently running. Are you sure you want to close?"
      : "Are you sure you want to close the app?";

    const { response } = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Close", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      title: "Close App",
      message,
    });

    if (response === 0) {
      forceClose = true;
      win.close();
    }
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
  botRunner?.stopAll();
  closeDb();
  if (process.platform !== "darwin") app.quit();
});

function setupIpcHandlers(): void {
  // Presets - session-scoped
  ipcMain.handle("presets:load", (_, sessionId: string) => loadPresets(sessionId));
  ipcMain.handle("presets:save", (_, sessionId: string, presets: unknown) => {
    savePresets(sessionId, presets as unknown[]);
    return true;
  });

  // Scheduled tasks - session-scoped
  ipcMain.handle("schedule:load", (_, sessionId: string) => loadScheduledTasks(sessionId));
  ipcMain.handle("schedule:save", (_, sessionId: string, tasks: unknown) => {
    saveScheduledTasks(sessionId, tasks as unknown[]);
    return true;
  });

  // Title bar theme - global
  ipcMain.handle("titlebar:theme", (_, theme: "dark" | "light") => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (theme === "light") {
      win.setTitleBarOverlay({ color: "#e2e8f0", symbolColor: "#334155", height: 36 });
    } else {
      win.setTitleBarOverlay({ color: "#0f172a", symbolColor: "#94a3b8", height: 36 });
    }
  });

  // Bot control - session-scoped
  ipcMain.handle("bot:start", (_, sessionId: string, config: unknown) =>
    botRunner?.start(sessionId, config as Parameters<BotRunner["start"]>[1]),
  );
  ipcMain.handle("bot:stop", (_, sessionId: string) => botRunner?.stop(sessionId));
  ipcMain.handle("bot:validate-token", (_, token: string) => botRunner?.validateToken(token));
}
