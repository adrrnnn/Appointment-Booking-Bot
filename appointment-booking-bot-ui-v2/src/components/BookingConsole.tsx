import { useEffect, useRef } from "react";
import type { AppStore } from "@/store/appStore";
import type { BotEvent } from "@/types";

interface Props {
  store: AppStore;
  sessionId: string;
}

const LOG_COLOR: Record<BotEvent["type"], string> = {
  log: "text-foreground",
  status: "text-blue-400",
  booked: "text-green-400 font-semibold",
  failed: "text-red-400",
  stopped: "text-muted-foreground",
  error: "text-red-400",
  ratelimit: "text-yellow-400",
};

const LOG_PREFIX: Record<BotEvent["type"], string> = {
  log: "",
  status: "[STATUS] ",
  booked: "[BOOKED] ",
  failed: "[FAILED] ",
  stopped: "[STOP]   ",
  error: "[ERROR]  ",
  ratelimit: "[LIMIT]  ",
};

function formatTs(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function BookingConsole({ store, sessionId }: Props) {
  const logRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (autoScrollRef.current && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [store.logs]);

  const activeDrivers = store.drivers.filter(
    (d) => d.driverName || d.bookingTokens.length > 0,
  );

  async function handleStart() {
    if (!store.searchToken.trim()) return;
    const drivers = store.drivers
      .filter((d) => d.driverName && d.bookingTokens.length > 0)
      .map((d) => ({
        driverName: d.driverName,
        bookingTokens: d.bookingTokens,
        licenseNo: d.licenseNo,
        plateCountry: d.plateCountry,
        residentCountry: d.residentCountry,
        vehicleSequenceNumber: d.vehicleSequenceNumber,
        chassisNo: d.chassisNo,
        declaration_number: d.declaration_number,
        hourPrefs: d.hourPrefs,
      }));

    if (drivers.length === 0) return;

    store.setBotRunning(true);
    store.clearLogs();

    try {
      await window.api.botStart(sessionId, {
        searchToken: store.searchToken.trim(),
        port_code: store.portCode,
        drivers,
      });
    } finally {
      store.setBotRunning(false);
    }
  }

  async function handleStop() {
    await window.api.botStop(sessionId);
    store.setBotRunning(false);
  }

  const canStart = !store.botRunning && !!store.searchToken.trim() &&
    store.drivers.some((d) => d.driverName && d.bookingTokens.length > 0);

  return (
    <div className="card flex flex-col overflow-hidden h-full">
      {/* Header row */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={store.botRunning ? handleStop : handleStart}
            disabled={!canStart && !store.botRunning}
            className={`px-8 py-2 rounded-md font-semibold text-sm transition-colors ${
              store.botRunning
                ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {store.botRunning ? "STOP" : "START"}
          </button>

          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${store.botRunning ? "bg-green-400 animate-pulse" : "bg-muted"}`} />
            <span className="text-xs text-muted-foreground">
              {store.botRunning ? "Running" : "Stopped"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {activeDrivers.slice(0, 4).map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${
                d.status === "active" ? "bg-green-400 animate-pulse" :
                d.status === "done" ? "bg-green-400" :
                d.status === "failed" ? "bg-red-400" :
                "bg-muted"
              }`} />
              <span className="text-muted-foreground">{d.driverName || `Driver ${i + 1}`}</span>
              <span className="text-xs text-muted-foreground">({d.bookingTokens.length}t)</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn-ghost text-xs text-muted-foreground ml-auto"
          onClick={store.clearLogs}
        >
          Clear Log
        </button>
      </div>

      {/* Log window */}
      <div
        ref={logRef}
        onScroll={() => {
          if (logRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = logRef.current;
            autoScrollRef.current = scrollTop + clientHeight >= scrollHeight - 20;
          }
        }}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-background/50"
      >
        {store.logs.length === 0 && (
          <div className="text-muted-foreground text-center py-8">
            Waiting for bot to start...
          </div>
        )}
        {store.logs.map((log, i) => (
          <div key={i} className={`flex gap-3 leading-5 ${LOG_COLOR[log.type]}`}>
            <span className="text-muted-foreground flex-shrink-0 select-none">{formatTs(log.timestamp)}</span>
            <span className="flex-shrink-0 select-none opacity-60">{LOG_PREFIX[log.type]}</span>
            <span className="break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
