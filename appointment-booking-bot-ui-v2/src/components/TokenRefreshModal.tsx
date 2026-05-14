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
  const [bookingValidateMsg, setBookingValidateMsg] = useState<string | null>(null);
  const [bookingValidateError, setBookingValidateError] = useState(false);
  const [bookingValidating, setBookingValidating] = useState(false);
  const [validatedBookingDraft, setValidatedBookingDraft] = useState<string | null>(null);

  const bookingTrim = bookingInput.trim();
  const canAddBooking =
    bookingTrim.length > 0 &&
    validatedBookingDraft !== null &&
    validatedBookingDraft === bookingTrim &&
    !bookingTokens.some((t) => t.trim() === bookingTrim);

  function onBookingInputChange(raw: string) {
    setBookingInput(raw);
    const t = raw.trim();
    if (validatedBookingDraft !== null && t !== validatedBookingDraft) {
      setValidatedBookingDraft(null);
    }
  }

  function addBookingToken() {
    if (!canAddBooking) return;
    setBookingTokens((prev) => [...prev, bookingTrim]);
    setBookingInput("");
    setValidatedBookingDraft(null);
    setBookingValidateMsg(null);
    setBookingValidateError(false);
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
            <div className="flex flex-col gap-2">
              <textarea
                className="input-field w-full font-mono text-xs min-h-[5rem] resize-y py-2"
                placeholder="Paste booking token, Validate tokens, then Add"
                value={bookingInput}
                onChange={(e) => onBookingInputChange(e.target.value)}
                spellCheck={false}
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn-primary text-xs px-3 disabled:opacity-50"
                  disabled={bookingValidating}
                  onClick={async () => {
                    const d = bookingInput.trim();
                    const listChecks = bookingTokens.map((tok) => tok.trim()).filter(Boolean);

                    if (d.length === 0 && listChecks.length === 0) {
                      setBookingValidateMsg("Paste a token first.");
                      setBookingValidateError(true);
                      setValidatedBookingDraft(null);
                      return;
                    }

                    setBookingValidating(true);
                    setBookingValidateMsg(null);
                    try {
                      const draftRes = d.length > 0 ? await window.api.validateToken(d) : { valid: true };
                      const listRes =
                        listChecks.length > 0
                          ? await Promise.all(listChecks.map((tok) => window.api.validateToken(tok)))
                          : [];

                      const listInvalid = listRes.filter((r) => !r.valid).length;
                      const draftInvalid = d.length > 0 ? !draftRes.valid : false;
                      const totalParts = (d.length > 0 ? 1 : 0) + listChecks.length;
                      const invalidCount = (draftInvalid ? 1 : 0) + listInvalid;

                      if (invalidCount === 0 && totalParts > 0) {
                        setBookingValidateError(false);
                        if (d.length > 0) {
                          setValidatedBookingDraft(d);
                          setBookingValidateMsg(
                            listChecks.length > 0
                              ? `Draft and ${listChecks.length} saved token(s) accepted.`
                              : "Token accepted. You can add it now.",
                          );
                        } else {
                          setValidatedBookingDraft(null);
                          setBookingValidateMsg(`All ${listChecks.length} saved token(s) accepted.`);
                        }
                      } else {
                        setValidatedBookingDraft(null);
                        setBookingValidateError(true);
                        setBookingValidateMsg(
                          `${invalidCount} of ${totalParts} token(s) failed. Fix and validate again.`,
                        );
                      }
                    } finally {
                      setBookingValidating(false);
                    }
                  }}
                >
                  {bookingValidating ? "Validating…" : "Validate tokens"}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!canAddBooking}
                  onClick={addBookingToken}
                >
                  Add
                </button>
              </div>
              {bookingValidateMsg && (
                <p
                  className={`text-xs ${
                    bookingValidateError ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                  }`}
                >
                  {bookingValidateMsg}
                </p>
              )}
            </div>
            {bookingTokens.length > 0 && (
              <div className="mt-2 space-y-2">
                {bookingTokens.map((t, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground mb-0.5 block">Token {i + 1}</span>
                      <textarea
                        className="input-field w-full font-mono text-xs min-h-[4.5rem] resize-y py-2"
                        value={t}
                        onChange={(e) => {
                          const next = [...bookingTokens];
                          next[i] = e.target.value;
                          setBookingTokens(next);
                          setValidatedBookingDraft(null);
                        }}
                        spellCheck={false}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-ghost text-xs text-muted-foreground hover:text-red-400 mt-6 flex-shrink-0"
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
