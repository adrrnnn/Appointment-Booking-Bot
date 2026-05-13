import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  // Presets - session-scoped
  loadPresets: (sessionId: string) => ipcRenderer.invoke("presets:load", sessionId),
  savePresets: (sessionId: string, presets: unknown) => ipcRenderer.invoke("presets:save", sessionId, presets),

  // Schedule - session-scoped
  loadSchedule: (sessionId: string) => ipcRenderer.invoke("schedule:load", sessionId),
  saveSchedule: (sessionId: string, tasks: unknown) => ipcRenderer.invoke("schedule:save", sessionId, tasks),

  // Bot - session-scoped
  botStart: (sessionId: string, config: unknown) => ipcRenderer.invoke("bot:start", sessionId, config),
  botStop: (sessionId: string) => ipcRenderer.invoke("bot:stop", sessionId),
  validateToken: (token: string) => ipcRenderer.invoke("bot:validate-token", token),

  // Theme - global
  setTitleBarTheme: (theme: "dark" | "light") => ipcRenderer.invoke("titlebar:theme", theme),

  // Bot events - renderer listens and filters by sessionId
  onBotEvent: (cb: (event: BotEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: BotEvent) => cb(event);
    ipcRenderer.on("bot:event", handler);
    return () => ipcRenderer.removeListener("bot:event", handler);
  },
});

export interface BotEvent {
  sessionId: string;
  type: "log" | "status" | "booked" | "failed" | "stopped" | "error" | "ratelimit";
  driverIdx?: number;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}
