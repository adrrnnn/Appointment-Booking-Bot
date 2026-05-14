import { useState, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useAppStore } from "@/store/appStore";
import { useScheduleTimer, type ScheduleTimerCallbacks } from "@/store/useScheduleTimer";
import { SearchTokenSection } from "./SearchTokenSection";
import { DriverTabs } from "./DriverTabs";
import { SchedulingArea } from "./SchedulingArea";
import { BookingConsole } from "./BookingConsole";
import { OutputArea } from "./OutputArea";
import { TokenRefreshModal } from "./TokenRefreshModal";
import type { BotEvent, ScheduledTask, DriverPreset } from "@/types";
import { driverWithBookingTokens, normalizeDriverPreset } from "@/utils/driverConfig";

const TABS = ["Drivers", "Scheduling", "Console", "Results"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  sessionId: string;
  isActive: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onBotRunningChange?: (sessionId: string, running: boolean) => void;
}

function enqueuePair(
  ref: MutableRefObject<{ task: ScheduledTask; preset: DriverPreset }[]>,
  setCur: Dispatch<SetStateAction<{ task: ScheduledTask; preset: DriverPreset } | null>>,
  task: ScheduledTask,
  preset: DriverPreset,
) {
  setCur((cur) => {
    if (cur) {
      ref.current.push({ task, preset });
      return cur;
    }
    return { task, preset };
  });
}

export function SessionContainer({ sessionId, isActive, theme, onToggleTheme, onBotRunningChange }: Props) {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>("Drivers");
  const [tokenRefreshTask, setTokenRefreshTask] = useState<{ task: ScheduledTask; preset: DriverPreset } | null>(null);
  const tokenQueueRef = useRef<{ task: ScheduledTask; preset: DriverPreset }[]>([]);
  const startedScheduledTaskIdsRef = useRef<Set<string>>(new Set());
  const scheduleCallbacksRef = useRef<ScheduleTimerCallbacks>({
    onPromptTokens: () => {},
    onStartTask: () => {},
  });

  function popNextTokenModal() {
    setTokenRefreshTask(() => {
      const next = tokenQueueRef.current.shift();
      return next ?? null;
    });
  }

  scheduleCallbacksRef.current = {
    onPromptTokens: (task, preset) => {
      enqueuePair(tokenQueueRef, setTokenRefreshTask, task, preset);
    },
    onStartTask: (task, preset) => {
      if (startedScheduledTaskIdsRef.current.has(task.id)) return;
      if (!task.freshSearchToken || !task.freshBookingTokens?.length) return;
      startedScheduledTaskIdsRef.current.add(task.id);
      const driver = driverWithBookingTokens(preset.driver, task.freshBookingTokens);
      store.setBotRunning(true);
      store.clearLogs();
      setTab("Console");
      void window.api.botStart(sessionId, {
        searchToken: task.freshSearchToken,
        port_code: store.portCode,
        drivers: [driver],
      }).finally(() => {
        startedScheduledTaskIdsRef.current.delete(task.id);
        store.setBotRunning(false);
      });
    },
  };

  useScheduleTimer(store, scheduleCallbacksRef, sessionId);

  useEffect(() => {
    onBotRunningChange?.(sessionId, store.botRunning);
  }, [sessionId, store.botRunning, onBotRunningChange]);

  useEffect(() => {
    window.api.loadPresets(sessionId).then((presets) =>
      store.setPresets(Array.isArray(presets) ? presets.map(normalizeDriverPreset) : []),
    );
    window.api.loadSchedule(sessionId).then(store.setScheduledTasks);
  }, [sessionId]);

  useEffect(() => {
    const unsub = window.api.onBotEvent((event: BotEvent & { sessionId: string }) => {
      if (event.sessionId !== sessionId) return;

      store.addLog(event);

      if (event.type === "booked") {
        const driverName = typeof event.driverIdx === "number"
          ? store.drivers[event.driverIdx]?.driverName ?? `Driver ${event.driverIdx + 1}`
          : "Unknown";
        store.setResults((prev) => [...prev, {
          driverName,
          driverIdx: event.driverIdx ?? 0,
          success: true,
          slot: event.data?.slot as string | undefined,
          timestamp: event.timestamp,
        }]);
        if (typeof event.driverIdx === "number") {
          store.updateDriver(event.driverIdx, { status: "done" });
        }
      }

      if (event.type === "failed" && typeof event.driverIdx === "number") {
        const driverName = store.drivers[event.driverIdx]?.driverName ?? `Driver ${event.driverIdx + 1}`;
        store.setResults((prev) => [...prev, {
          driverName,
          driverIdx: event.driverIdx ?? 0,
          success: false,
          reason: event.message,
          timestamp: event.timestamp,
        }]);
        store.updateDriver(event.driverIdx, { status: "failed" });
      }

      if (event.type === "stopped") {
        store.setBotRunning(false);
        store.drivers.forEach((_, i) => {
          if (store.drivers[i].status === "active") {
            store.updateDriver(i, { status: "idle" });
          }
        });
      }
    });
    return unsub;
  }, [store, sessionId]);

  function handleTokenRefreshConfirm(taskId: string, searchToken: string, bookingTokens: string[]) {
    const updated = store.scheduledTasks.map((t) =>
      t.id === taskId
        ? { ...t, status: "tokens_ready" as const, freshSearchToken: searchToken, freshBookingTokens: bookingTokens }
        : t,
    );
    const taskRow = updated.find((t) => t.id === taskId);
    store.setScheduledTasks(updated);
    window.api.saveSchedule(sessionId, updated);
    popNextTokenModal();

    if (
      taskRow &&
      taskRow.freshSearchToken &&
      taskRow.freshBookingTokens?.length &&
      taskRow.scheduledFor <= Date.now()
    ) {
      if (startedScheduledTaskIdsRef.current.has(taskId)) return;
      startedScheduledTaskIdsRef.current.add(taskId);
      const preset = store.presets.find((p) => p.id === taskRow.presetId);
      if (!preset) {
        startedScheduledTaskIdsRef.current.delete(taskId);
        return;
      }
      const withRunning = updated.map((t) =>
        t.id === taskId ? { ...t, status: "running" as const } : t,
      );
      store.setScheduledTasks(withRunning);
      window.api.saveSchedule(sessionId, withRunning);
      const driver = driverWithBookingTokens(preset.driver, taskRow.freshBookingTokens);
      store.setBotRunning(true);
      store.clearLogs();
      setTab("Console");
      void window.api.botStart(sessionId, {
        searchToken: taskRow.freshSearchToken,
        port_code: store.portCode,
        drivers: [driver],
      }).finally(() => {
        startedScheduledTaskIdsRef.current.delete(taskId);
        store.setBotRunning(false);
      });
    }
  }

  function handleUseSavedTokensFromModal(): string | null {
    if (!tokenRefreshTask) return "No active task.";
    const search = store.searchToken.trim();
    const booking = tokenRefreshTask.preset.driver.bookingTokens.map((t) => t.trim()).filter(Boolean);
    if (!search) return "Paste or validate a search token in the header first.";
    if (booking.length === 0) return "This preset has no booking tokens. Add them on the preset or enter new tokens below.";
    handleTokenRefreshConfirm(tokenRefreshTask.task.id, search, booking);
    return null;
  }

  function handleForceStart(task: ScheduledTask) {
    const preset = store.presets.find((p) => p.id === task.presetId);
    if (!preset) return;
    if (!task.freshSearchToken || !task.freshBookingTokens?.length) {
      enqueuePair(tokenQueueRef, setTokenRefreshTask, task, preset);
      return;
    }
    const updated = store.scheduledTasks.map((t) =>
      t.id === task.id ? { ...t, status: "running" as const } : t,
    );
    store.setScheduledTasks(updated);
    window.api.saveSchedule(sessionId, updated);
    const driver = driverWithBookingTokens(preset.driver, task.freshBookingTokens);
    store.setBotRunning(true);
    store.clearLogs();
    setTab("Console");
    void window.api.botStart(sessionId, {
      searchToken: task.freshSearchToken,
      port_code: store.portCode,
      drivers: [driver],
    }).finally(() => store.setBotRunning(false));
  }

  function handleTokenRefreshDismiss() {
    if (!tokenRefreshTask) return;
    const updated = store.scheduledTasks.map((t) =>
      t.id === tokenRefreshTask.task.id ? { ...t, status: "failed" as const } : t,
    );
    store.setScheduledTasks(updated);
    window.api.saveSchedule(sessionId, updated);
    popNextTokenModal();
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ display: isActive ? "flex" : "none" }}>
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <SearchTokenSection store={store} />
      </div>

      <div className="px-4 pb-2 flex-shrink-0 flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tab === t
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {store.botRunning && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Running
            </span>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
          >
            {theme === "dark" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-4">
        {tab === "Drivers" && <DriverTabs store={store} sessionId={sessionId} />}
        {tab === "Scheduling" && (
          <div className="h-full">
            <SchedulingArea store={store} sessionId={sessionId} onForceStart={handleForceStart} />
          </div>
        )}
        {tab === "Console" && <BookingConsole store={store} sessionId={sessionId} />}
        {tab === "Results" && (
          <div className="space-y-4 overflow-y-auto h-full">
            <OutputArea store={store} />
          </div>
        )}
      </div>

      {tokenRefreshTask && (
        <TokenRefreshModal
          task={tokenRefreshTask.task}
          preset={tokenRefreshTask.preset}
          onConfirm={handleTokenRefreshConfirm}
          onDismiss={handleTokenRefreshDismiss}
          onUseSavedTokens={handleUseSavedTokensFromModal}
        />
      )}
    </div>
  );
}
