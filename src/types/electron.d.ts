import type { BotEvent, DriverPreset, ScheduledTask } from "./index";

declare global {
  interface Window {
    api: {
      loadPresets: () => Promise<DriverPreset[]>;
      savePresets: (presets: DriverPreset[]) => Promise<void>;
      loadSchedule: () => Promise<ScheduledTask[]>;
      saveSchedule: (tasks: ScheduledTask[]) => Promise<void>;
      botStart: (config: unknown) => Promise<void>;
      botStop: () => Promise<void>;
      validateToken: (token: string) => Promise<{ valid: boolean; message: string }>;
      setTitleBarTheme: (theme: "dark" | "light") => Promise<void>;
      onBotEvent: (cb: (event: BotEvent) => void) => () => void;
    };
  }
}
