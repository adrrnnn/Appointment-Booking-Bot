import { BrowserWindow } from "electron";
import { runOrchestrator, type BotConfig, type BotEventCallback } from "./engine-bridge";

export class BotRunner {
  private win: BrowserWindow;
  private abortController: AbortController | null = null;
  private running = false;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  private emit(type: string, message: string, driverIdx?: number, data?: Record<string, unknown>): void {
    if (this.win.isDestroyed()) return;
    this.win.webContents.send("bot:event", {
      type,
      message,
      driverIdx,
      timestamp: Date.now(),
      data,
    });
  }

  async start(config: BotConfig): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.abortController = new AbortController();

    const onEvent: BotEventCallback = (type, message, driverIdx, data) => {
      this.emit(type, message, driverIdx, data);
    };

    try {
      await runOrchestrator(config, this.abortController.signal, onEvent);
    } catch (err) {
      this.emit("error", (err as Error).message);
    } finally {
      this.running = false;
      this.abortController = null;
      this.emit("stopped", "Bot stopped.");
    }
  }

  stop(): void {
    this.abortController?.abort();
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
