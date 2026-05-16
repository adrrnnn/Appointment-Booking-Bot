import { BrowserWindow } from "electron";
import { runOrchestrator, stopSession, stopAll, type BotConfig } from "./engine-bridge";

export class BotRunner {
  private win: BrowserWindow;
  private running = new Set<string>();
  private chains = new Map<string, Promise<void>>();

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  private emit(sessionId: string, type: string, message: string, driverIdx?: number, data?: Record<string, unknown>): void {
    if (this.win.isDestroyed()) return;
    this.win.webContents.send("bot:event", {
      sessionId,
      type,
      message,
      driverIdx,
      timestamp: Date.now(),
      data,
    });
  }

  async start(sessionId: string, config: BotConfig): Promise<void> {
    const run = async (): Promise<void> => {
      const other = [...this.running].filter((id) => id !== sessionId);
      if (other.length > 0) {
        this.emit(
          sessionId,
          "error",
          "Another session is running the bot. Stop it there or wait until it finishes.",
        );
        return;
      }
      this.running.add(sessionId);
      try {
        await runOrchestrator(sessionId, config, (sid, type, message, driverIdx, data) => {
          this.emit(sid, type, message, driverIdx, data);
        });
      } catch (err) {
        this.emit(sessionId, "error", (err as Error).message);
      } finally {
        this.running.delete(sessionId);
      }
    };

    // Recover from a rejected chain so a prior failure does not drop queued runs
    const prev = (this.chains.get(sessionId) ?? Promise.resolve()).catch(() => {});
    const next = prev.then(run);
    this.chains.set(sessionId, next);
    await next;
  }

  stop(sessionId: string): void {
    this.chains.delete(sessionId);
    stopSession(sessionId);
    this.running.delete(sessionId);
  }

  stopAll(): void {
    this.chains.clear();
    stopAll();
    this.running.clear();
  }

  hasAnyRunning(): boolean {
    return this.running.size > 0;
  }

  async validateToken(token: string): Promise<{ valid: boolean; message: string }> {
    try {
      const res = await fetch(
        "https://fasah.zatca.gov.sa/api/zatca-tas/v2/zone/schedule/land?departure=AGF&arrival=41&type=TRANSIT&economicOperator=",
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "accept-language": "en-US,en;q=0.9",
            token,
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
          },
          method: "GET",
        },
      );
      if (res.status === 401 || res.status === 403) return { valid: false, message: "Token invalid or expired" };
      if (res.status === 429) return { valid: true, message: "Token valid (rate limited)" };
      if (res.ok) return { valid: true, message: "Token valid" };
      return { valid: false, message: `HTTP ${res.status}` };
    } catch {
      return { valid: false, message: "Connection failed" };
    }
  }
}
