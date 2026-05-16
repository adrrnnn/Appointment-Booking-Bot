import { useEffect, useRef, type MutableRefObject } from "react";
import type { AppStore } from "./appStore";
import type { ScheduledTask, DriverPreset } from "@/types";
import { SESSION_SCHEDULE_PRESET_ID } from "@/types";
import { sessionSchedulePlaceholderPreset } from "@/utils/sessionRun";

const TOKEN_PROMPT_LEAD_MS = 40 * 60 * 1000; // 40 minutes before
const CHECK_INTERVAL_MS = 10_000;

export interface ScheduleTimerCallbacks {
  onPromptTokens: (task: ScheduledTask, preset: DriverPreset) => void;
  onStartTask: (task: ScheduledTask, preset: DriverPreset) => void;
}

export function useScheduleTimer(
  store: AppStore,
  callbacksRef: MutableRefObject<ScheduleTimerCallbacks>,
  sessionId: string,
): void {
  const storeRef = useRef(store);
  storeRef.current = store;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const { scheduledTasks, presets, setScheduledTasks } = storeRef.current;

      let next = [...scheduledTasks];
      let changed = false;
      const prompts: { task: ScheduledTask; preset: DriverPreset }[] = [];
      const starts: { task: ScheduledTask; preset: DriverPreset }[] = [];

      for (let i = 0; i < next.length; i++) {
        const task = next[i];
        const preset: DriverPreset | undefined =
          task.runMode === "session" || task.presetId === SESSION_SCHEDULE_PRESET_ID
            ? sessionSchedulePlaceholderPreset()
            : presets.find((p) => p.id === task.presetId);
        if (!preset) continue;

        const timeUntil = task.scheduledFor - now;

        if (task.status === "pending" && timeUntil <= TOKEN_PROMPT_LEAD_MS) {
          const updated: ScheduledTask = { ...task, status: "awaiting_tokens" };
          next[i] = updated;
          changed = true;
          prompts.push({ task: updated, preset });
        }

        if (task.status === "tokens_ready" && timeUntil <= 0) {
          const updated: ScheduledTask = { ...task, status: "running" };
          next[i] = updated;
          changed = true;
          starts.push({ task: updated, preset });
        }

        if (task.status === "awaiting_tokens" && timeUntil <= -60_000) {
          next[i] = { ...task, status: "failed" };
          changed = true;
        }
      }

      if (changed) {
        setScheduledTasks(next);
        window.api.saveSchedule(sessionIdRef.current, next);
      }

      for (const p of prompts) {
        callbacksRef.current.onPromptTokens(p.task, p.preset);
      }
      for (const s of starts) {
        callbacksRef.current.onStartTask(s.task, s.preset);
      }
    }

    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    tick();
    return () => clearInterval(interval);
  }, [sessionId]);
}
