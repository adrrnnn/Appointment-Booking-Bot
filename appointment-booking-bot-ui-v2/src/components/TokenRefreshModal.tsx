import { useState } from "react";
import type { ScheduledTask, DriverPreset } from "@/types";

interface Props {
  task: ScheduledTask;
  preset: DriverPreset;
  onConfirm: (taskId: string, searchToken: string, bookingTokens: string[]) => void;
  onDismiss: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function minutesUntil(ts: number): number {
  return Math.max(0, Math.round((ts - Date.now()) / 60_000));
}

export function TokenRefreshModal({ task, preset, onConfirm, onDismiss }: Props) {
  const [searchToken, setSearchToken] = useState("");
  const [bookingInput, setBookingInput] = useState("");
  const [bookingTokens, setBookingTokens] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  function addBookingToken() {
    const t = bookingInput.trim();
    if (!t || bookingTokens.includes(t)) return;
    setBookingTokens((prev) => [...prev, t]);
    setBookingInput("");
  }

  function handleConfirm() {
    if (!searchToken.trim() || bookingTokens.length === 0) return;
    onConfirm(task.id, searchToken.trim(), bookingTokens);
  }

  const canConfirm = searchToken.trim().length > 0 && bookingTokens.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="card w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Fresh Tokens Required</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scheduled run starts in {minutesUntil(task.scheduledFor)} min ({formatTime(task.scheduledFor)})
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-accent/30 rounded-md px-3 py-2 text-xs text-muted-foreground">
            Task: <span className="text-foreground font-medium">{task.presetName}</span>
            {" "} - Driver {task.driverIdx + 1}
          </div>

          {/* Search token */}
          <div>
            <label className="label">Search Token</label>
            <div className="relative">
              <input
                type={showSearch ? "text" : "password"}
                className="input-field font-mono text-xs pr-12"
                placeholder="Paste fresh search token..."
                value={searchToken}
                onChange={(e) => setSearchToken(e.target.value)}
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowSearch((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs transition-colors"
                tabIndex={-1}
              >
                {showSearch ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Booking tokens */}
          <div>
            <label className="label">
              Booking Tokens for {preset.driver.driverName || `Driver ${task.driverIdx + 1}`}
              <span className="ml-2 font-normal normal-case text-muted-foreground">
                ({bookingTokens.length} added)
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                className="input-field flex-1 font-mono text-xs"
                placeholder="Paste booking token and press Add..."
                value={bookingInput}
                onChange={(e) => setBookingInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBookingToken(); } }}
                spellCheck={false}
              />
              <button
                type="button"
                className="btn-secondary text-xs px-3 flex-shrink-0"
                onClick={addBookingToken}
              >
                Add
              </button>
            </div>
            {bookingTokens.length > 0 && (
              <div className="mt-2 space-y-1">
                {bookingTokens.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs font-mono">
                    <span className="text-muted-foreground">Token {i + 1}</span>
                    <span className="flex-1 truncate">{"*".repeat(12)}{t.slice(-6)}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                      onClick={() => setBookingTokens((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Bot will start automatically at {formatTime(task.scheduledFor)}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="btn-ghost text-xs text-muted-foreground"
              onClick={onDismiss}
            >
              Skip Task
            </button>
            <button
              type="button"
              className="btn-primary text-xs px-4"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              Confirm Tokens
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
