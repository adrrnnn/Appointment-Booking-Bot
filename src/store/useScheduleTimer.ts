import { useEffect, useRef } from "react";
import type { AppStore } from "./appStore";
import type { ScheduledTask, DriverPreset } from "@/types";

const TOKEN_PROMPT_LEAD_MS = 40 * 60 * 1000; // 40 minutes before
const CHECK_INTERVAL_MS = 30_000; // check every 30 seconds

interface Callbacks {
  onPromptTokens: (task: ScheduledTask, preset: DriverPreset) => void;
  onStartTask: (task: ScheduledTask, preset: DriverPreset) => void;
}

export function useScheduleTimer(store: AppStore, { onPromptTokens, onStartTask }: Callbacks, sessionId: string): void {
  const storeRef = useRef(store);
  storeRef.current = store;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const { scheduledTasks, presets } = storeRef.current;

      for (const task of scheduledTasks) {
        const preset = presets.find((p) => p.id === task.presetId);
        if (!preset) continue;

        const timeUntil = task.scheduledFor - now;

        // Fire token prompt at ~40 min before (within a 30s window to avoid double-firing)
        if (
          task.status === "pending" &&
          timeUntil <= TOKEN_PROMPT_LEAD_MS &&
          timeUntil > TOKEN_PROMPT_LEAD_MS - CHECK_INTERVAL_MS
        ) {
          updateTaskStatus(task.id, "awaiting_tokens");
          onPromptTokens(task, preset);
        }

        // Auto-start when time arrives and tokens are ready
        if (
          task.status === "tokens_ready" &&
          timeUntil <= 0
        ) {
          updateTaskStatus(task.id, "running");
          onStartTask(task, preset);
        }

        // If tokens were never provided and the time has passed, mark as failed
        if (
          task.status === "awaiting_tokens" &&
          timeUntil <= -60_000 // 1 minute grace
        ) {
          updateTaskStatus(task.id, "failed");
        }
      }
    }

    function updateTaskStatus(id: string, status: ScheduledTask["status"]) {
      const updated = storeRef.current.scheduledTasks.map((t) =>
        t.id === id ? { ...t, status } : t,
      );
      storeRef.current.setScheduledTasks(updated);
      window.api.saveSchedule(sessionIdRef.current, updated);
    }

    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    tick();
    return () => clearInterval(interval);
  }, []);
}
