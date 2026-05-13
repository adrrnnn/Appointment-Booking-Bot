import { utilityProcess } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

export type BotEventType = "log" | "status" | "booked" | "failed" | "stopped" | "error" | "ratelimit";
export type BotEventCallback = (
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
  plateNo: string;
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

let childProcess: Electron.UtilityProcess | null = null;

export async function runOrchestrator(
  config: BotConfig,
  signal: AbortSignal,
  onEvent: BotEventCallback,
): Promise<void> {
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

    childProcess = utilityProcess.fork(botScript, [], {
      env,
      cwd: botDir,
      stdio: "pipe",
    });

    childProcess.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        const clean = stripAnsi(line);
        if (!clean) continue;
        const type = classifyLine(clean);
        onEvent(type, clean);
      }
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      const clean = stripAnsi(data.toString().trim());
      if (clean) onEvent("error", clean);
    });

    childProcess.on("exit", (code) => {
      childProcess = null;
      if (code === 0 || signal.aborted) resolve();
      else reject(new Error(`Bot exited with code ${code}`));
    });

    signal.addEventListener("abort", () => {
      childProcess?.kill();
    });
  });
}
