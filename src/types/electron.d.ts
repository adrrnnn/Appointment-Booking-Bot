import type { BotEvent, DriverPreset, ScheduledTask } from "./index";

declare global {
  interface Window {
    api: {
      loadPresets: (sessionId: string) => Promise<DriverPreset[]>;
      savePresets: (sessionId: string, presets: DriverPreset[]) => Promise<void>;
      loadSchedule: (sessionId: string) => Promise<ScheduledTask[]>;
      saveSchedule: (sessionId: string, tasks: ScheduledTask[]) => Promise<void>;
      botStart: (sessionId: string, config: unknown) => Promise<void>;
      botStop: (sessionId: string) => Promise<void>;
      validateToken: (token: string) => Promise<{ valid: boolean; message: string }>;
      setTitleBarTheme: (theme: "dark" | "light") => Promise<void>;
      onBotEvent: (cb: (event: BotEvent & { sessionId: string }) => void) => () => void;
    };
  }
}
