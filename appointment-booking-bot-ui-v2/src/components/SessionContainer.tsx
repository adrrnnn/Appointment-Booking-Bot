import { useState, useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useScheduleTimer } from "@/store/useScheduleTimer";
import { SearchTokenSection } from "./SearchTokenSection";
import { DriverTabs } from "./DriverTabs";
import { SchedulingArea } from "./SchedulingArea";
import { BookingConsole } from "./BookingConsole";
import { OutputArea } from "./OutputArea";
import { TokenRefreshModal } from "./TokenRefreshModal";
import type { BotEvent, ScheduledTask, DriverPreset } from "@/types";

const TABS = ["Drivers", "Scheduling", "Console", "Results"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  sessionId: string;
  isActive: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onBotRunningChange?: (sessionId: string, running: boolean) => void;
}

export function SessionContainer({ sessionId, isActive, theme, onToggleTheme, onBotRunningChange }: Props) {
  const store = useAppStore();
  const [tab, setTab] = useState<Tab>("Drivers");
  const [tokenRefreshTask, setTokenRefreshTask] = useState<{ task: ScheduledTask; preset: DriverPreset } | null>(null);

  useScheduleTimer(store, {
    onPromptTokens: (task, preset) => {
      setTokenRefreshTask({ task, preset });
    },
    onStartTask: (task, preset) => {
      if (!task.freshSearchToken || !task.freshBookingTokens?.length) return;
      const driver = { ...preset.driver, bookingTokens: task.freshBookingTokens };
      store.setBotRunning(true);
      store.clearLogs();
      setTab("Console");
      window.api.botStart(sessionId, {
        searchToken: task.freshSearchToken,
        port_code: store.portCode,
        drivers: [driver],
      }).finally(() => store.setBotRunning(false));
    },
  }, sessionId);

  useEffect(() => {
    onBotRunningChange?.(sessionId, store.botRunning);
  }, [sessionId, store.botRunning, onBotRunningChange]);

  // Load persisted data on mount
  useEffect(() => {
    window.api.loadPresets(sessionId).then(store.setPresets);
    window.api.loadSchedule(sessionId).then(store.setScheduledTasks);
  }, [sessionId]);

  // Subscribe to bot events for this session only
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

      if (event.type === "status" || event.type === "log") {
        setTab("Console");
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
    store.setScheduledTasks(updated);
    window.api.saveSchedule(sessionId, updated);
    setTokenRefreshTask(null);
  }

  function handleForceStart(task: ScheduledTask) {
    const preset = store.presets.find((p) => p.id === task.presetId);
    if (!preset) return;
    if (!task.freshSearchToken || !task.freshBookingTokens?.length) {
      setTokenRefreshTask({ task, preset });
      return;
    }
    const updated = store.scheduledTasks.map((t) =>
      t.id === task.id ? { ...t, status: "running" as const } : t,
    );
    store.setScheduledTasks(updated);
    window.api.saveSchedule(sessionId, updated);
    const driver = { ...preset.driver, bookingTokens: task.freshBookingTokens };
    store.setBotRunning(true);
    store.clearLogs();
    setTab("Console");
    window.api.botStart(sessionId, {
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
    setTokenRefreshTask(null);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ display: isActive ? "flex" : "none" }}>
      {/* Search token - always visible */}
      <div className="px-4 pt-3 pb-2 flex-shrink-0">
        <SearchTokenSection store={store} />
      </div>

      {/* Inner tab bar */}
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

      {/* Main content */}
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
        />
      )}
    </div>
  );
}
