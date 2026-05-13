import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  // Presets
  loadPresets: () => ipcRenderer.invoke("presets:load"),
  savePresets: (presets: unknown) => ipcRenderer.invoke("presets:save", presets),

  // Schedule
  loadSchedule: () => ipcRenderer.invoke("schedule:load"),
  saveSchedule: (tasks: unknown) => ipcRenderer.invoke("schedule:save", tasks),

  // Bot
  botStart: (config: unknown) => ipcRenderer.invoke("bot:start", config),
  botStop: () => ipcRenderer.invoke("bot:stop"),
  validateToken: (token: string) => ipcRenderer.invoke("bot:validate-token", token),

  // Theme
  setTitleBarTheme: (theme: "dark" | "light") => ipcRenderer.invoke("titlebar:theme", theme),

  // Bot events (renderer listens to these)
  onBotEvent: (cb: (event: BotEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: BotEvent) => cb(event);
    ipcRenderer.on("bot:event", handler);
    return () => ipcRenderer.removeListener("bot:event", handler);
  },
});

export interface BotEvent {
  type: "log" | "status" | "booked" | "failed" | "stopped" | "error" | "ratelimit";
  driverIdx?: number;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}
