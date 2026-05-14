import { utilityProcess } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

export type BotEventType = "log" | "status" | "booked" | "failed" | "stopped" | "error" | "ratelimit";
export type BotEventCallback = (
  sessionId: string,
  type: BotEventType,
  message: string,
  driverIdx?: number,
  data?: Record<string, unknown>,
) => void;

export interface DriverConfig {
  driverName: string;
  bookingTokens: string[];
  licenseNo: string;
  plateCountry: string;
  residentCountry: string;
  vehicleSequenceNumber: string;
  chassisNo: string;
  declaration_number: string;
  hourPrefs: {
    tier1: number | null;
    tier2Start: number | null;
    tier2End: number | null;
  };
}

export interface BotConfig {
  searchToken: string;
  port_code: string;
  drivers: DriverConfig[];
}

const ANSI_STRIP = /\x1B\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_STRIP, "").trim();
}

function classifyLine(line: string): BotEventType {
  const l = line.toLowerCase();
  if (l.includes("appointment = true") || l.includes("booked")) return "booked";
  if (l.includes("appointment = false") || l.includes("failed") || l.includes("invalid")) return "failed";
  if (l.includes("rate limit") || l.includes("rate limited") || l.includes("cooldown")) return "ratelimit";
  if (l.includes("error") || l.includes("fatal")) return "error";
  if (l.includes("searching") || l.includes("attempt")) return "status";
  return "log";
}

// Map of sessionId -> running child process
const processes = new Map<string, Electron.UtilityProcess>();

// Map of sessionId -> AbortController for stopping
const abortControllers = new Map<string, AbortController>();

export async function runOrchestrator(
  sessionId: string,
  config: BotConfig,
  onEvent: BotEventCallback,
): Promise<void> {
  // Stop any existing process for this session first
  stopSession(sessionId);

  const controller = new AbortController();
  abortControllers.set(sessionId, controller);

  return new Promise((resolve, reject) => {
    const botDir = is.dev
      ? join(__dirname, "../../bot")
      : join(process.resourcesPath, "bot");

    const botScript = join(botDir, "dist", "index.js");

    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    env["BOT_UI_MODE"] = "1";
    env["BOT_CONFIG"] = JSON.stringify(config);

    const child = utilityProcess.fork(botScript, [], {
      env,
      cwd: botDir,
      stdio: "pipe",
    });

    processes.set(sessionId, child);

    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        const clean = stripAnsi(line);
        if (!clean) continue;
        const type = classifyLine(clean);
        onEvent(sessionId, type, clean);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const clean = stripAnsi(data.toString().trim());
      if (clean) onEvent(sessionId, "error", clean);
    });

    child.on("exit", (code) => {
      processes.delete(sessionId);
      abortControllers.delete(sessionId);
      onEvent(sessionId, "stopped", "Bot stopped.");
      if (code === 0 || controller.signal.aborted) resolve();
      else reject(new Error(`Bot exited with code ${code}`));
    });

    controller.signal.addEventListener("abort", () => {
      child.kill();
    });
  });
}

export function stopSession(sessionId: string): void {
  const controller = abortControllers.get(sessionId);
  if (controller) {
    controller.abort();
  }
  const child = processes.get(sessionId);
  if (child) {
    child.kill();
    processes.delete(sessionId);
    abortControllers.delete(sessionId);
  }
}

export function stopAll(): void {
  for (const sessionId of Array.from(processes.keys())) {
    stopSession(sessionId);
  }
}
