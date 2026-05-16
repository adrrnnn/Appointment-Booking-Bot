import { useState } from "react";
import type { AppStore } from "@/store/appStore";
import type { ScheduledTask } from "@/types";
import { SESSION_SCHEDULE_PRESET_ID } from "@/types";

interface Props {
  store: AppStore;
  sessionId: string;
  onForceStart: (task: ScheduledTask) => void;
  onStartSessionNow: () => void;
}

const TASK_STATUS_CLASS: Record<ScheduledTask["status"], string> = {
  pending: "badge-scheduled",
  awaiting_tokens: "badge-invalid",
  tokens_ready: "badge-ready",
  running: "badge-active",
  done: "badge-done",
  failed: "badge-failed",
};

const TASK_STATUS_LABEL: Record<ScheduledTask["status"], string> = {
  pending: "pending",
  awaiting_tokens: "needs tokens",
  tokens_ready: "ready",
  running: "running",
  done: "done",
  failed: "failed",
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SessionSlotPreset = string[];

function buildSessionSlots(n: number, prev: SessionSlotPreset): SessionSlotPreset {
  const next = prev.slice(0, n);
  while (next.length < n) next.push("");
  return next;
}

function SessionForkModal({
  open,
  forkScheduleAt,
  onForkScheduleAtChange,
  showSchedulePicker,
  onShowSchedulePicker,
  onStartNow,
  onQueueSchedule,
  onDecideLater,
}: {
  open: boolean;
  forkScheduleAt: string;
  onForkScheduleAtChange: (v: string) => void;
  showSchedulePicker: boolean;
  onShowSchedulePicker: () => void;
  onStartNow: () => void;
  onQueueSchedule: () => void;
  onDecideLater: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card w-full max-w-md shadow-2xl" role="dialog" aria-labelledby="fork-modal-title">
        <div className="px-5 py-4 border-b border-border">
          <h2 id="fork-modal-title" className="text-sm font-semibold text-foreground">
            Session loaded
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Driver tabs were updated. Start now for all ready drivers, or schedule this session.
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <button type="button" className="btn-primary text-xs px-3 py-2 w-full" onClick={onStartNow}>
            Start now
          </button>
          {!showSchedulePicker ? (
            <button type="button" className="btn-secondary text-xs px-3 py-2 w-full" onClick={onShowSchedulePicker}>
              Schedule for later
            </button>
          ) : (
            <div className="space-y-2">
              <label className="label text-xs">Run at</label>
              <input
                type="datetime-local"
                className="input-field w-full text-xs"
                value={forkScheduleAt}
                onChange={(e) => onForkScheduleAtChange(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              <button
                type="button"
                className="btn-primary text-xs px-3 py-2 w-full"
                onClick={onQueueSchedule}
                disabled={!forkScheduleAt}
              >
                Add to queue
              </button>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button type="button" className="btn-ghost text-xs text-muted-foreground" onClick={onDecideLater}>
            Decide later
          </button>
        </div>
      </div>
    </div>
  );
}

export function SchedulingArea({ store, sessionId, onForceStart, onStartSessionNow }: Props) {
  const nDrivers = store.drivers.length;

  const [sessionSlots, setSessionSlots] = useState<SessionSlotPreset>(() => buildSessionSlots(4, []));

  const [sessionScheduledFor, setSessionScheduledFor] = useState("");

  const [forkModalOpen, setForkModalOpen] = useState(false);
  const [forkScheduleAt, setForkScheduleAt] = useState("");
  const [forkShowSchedulePicker, setForkShowSchedulePicker] = useState(false);

  const [moreStartScheduleOpen, setMoreStartScheduleOpen] = useState(false);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [selectedDriverIdx, setSelectedDriverIdx] = useState(0);
  const [legacyScheduledFor, setLegacyScheduledFor] = useState("");

  const slotsForUi = buildSessionSlots(nDrivers, sessionSlots);

  function updateSessionSlot(slotIdx: number, presetId: string) {
    setSessionSlots((prev) => {
      const base = buildSessionSlots(nDrivers, prev);
      base[slotIdx] = presetId;
      return base;
    });
  }

  function queueFullSessionAt(localIso: string) {
    if (!localIso) return;
    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      presetId: SESSION_SCHEDULE_PRESET_ID,
      presetName: "Full session",
      driverIdx: 0,
      scheduledFor: new Date(localIso).getTime(),
      status: "pending",
      runMode: "session",
    };
    const updated = [...store.scheduledTasks, task];
    store.setScheduledTasks(updated);
    window.api.saveSchedule(sessionId, updated);
  }

  function handleLoadSessionFromSlots() {
    let applied = 0;
    for (let i = 0; i < nDrivers; i++) {
      const pid = slotsForUi[i];
      if (!pid) continue;
      const preset = store.presets.find((p) => p.id === pid);
      if (preset) {
        store.loadPreset(preset, i);
        applied++;
      }
    }
    if (applied === 0) {
      window.alert("Select at least one preset for a driver tab, or choose Skip only for tabs you will not use.");
      return;
    }
    setForkScheduleAt("");
    setForkShowSchedulePicker(false);
    setForkModalOpen(true);
  }

  function closeForkModal() {
    setForkModalOpen(false);
    setForkScheduleAt("");
    setForkShowSchedulePicker(false);
  }

  function handleForkStartNow() {
    closeForkModal();
    onStartSessionNow();
  }

  function handleForkQueueSchedule() {
    if (!forkScheduleAt) return;
    queueFullSessionAt(forkScheduleAt);
    closeForkModal();
  }

  function handleScheduleFullSession() {
    if (!sessionScheduledFor) return;
    queueFullSessionAt(sessionScheduledFor);
    setSessionScheduledFor("");
  }

  function handleStartNowClick() {
    if (!window.confirm("Start the bot now for every driver tab that is ready (same as the Console)?")) return;
    onStartSessionNow();
  }

  function handleLoadPreset(presetId: string, driverIdx: number) {
    const preset = store.presets.find((p) => p.id === presetId);
    if (!preset) return;
    store.loadPreset(preset, driverIdx);
  }

  function handleQueueLegacyTask() {
    if (!selectedPresetId || !legacyScheduledFor) return;
    const preset = store.presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      presetId: selectedPresetId,
      presetName: preset.name,
      driverIdx: selectedDriverIdx,
      scheduledFor: new Date(legacyScheduledFor).getTime(),
      status: "pending",
      runMode: "single",
    };
    const updated = [...store.scheduledTasks, task];
    store.setScheduledTasks(updated);
    window.api.saveSchedule(sessionId, updated);
    setLegacyScheduledFor("");
  }

  function handleDeletePreset(id: string) {
    const updated = store.presets.filter((p) => p.id !== id);
    store.setPresets(updated);
    window.api.savePresets(sessionId, updated);
  }

  function handleRemoveTask(id: string) {
    const updated = store.scheduledTasks.filter((t) => t.id !== id);
    store.setScheduledTasks(updated);
    window.api.saveSchedule(sessionId, updated);
  }

  function taskSubtitle(task: ScheduledTask): string {
    if (task.runMode === "session" || task.presetId === SESSION_SCHEDULE_PRESET_ID) {
      return `Full session - ${formatDate(task.scheduledFor)}`;
    }
    return `Driver ${task.driverIdx + 1} - ${formatDate(task.scheduledFor)}`;
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <SessionForkModal
        open={forkModalOpen}
        forkScheduleAt={forkScheduleAt}
        onForkScheduleAtChange={setForkScheduleAt}
        showSchedulePicker={forkShowSchedulePicker}
        onShowSchedulePicker={() => setForkShowSchedulePicker(true)}
        onStartNow={handleForkStartNow}
        onQueueSchedule={handleForkQueueSchedule}
        onDecideLater={closeForkModal}
      />

      <div className="card flex flex-col overflow-hidden flex-shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Session</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Load presets into driver tabs. You will be asked to start now or schedule next.
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="label">Load session (preset per driver tab)</label>
            <div className="grid gap-2">
              {store.drivers.map((_, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">Driver {i + 1}</span>
                  <select
                    className="input-field text-xs flex-1 min-w-[8rem]"
                    value={slotsForUi[i] ?? ""}
                    onChange={(e) => updateSessionSlot(i, e.target.value)}
                    disabled={store.presets.length === 0}
                  >
                    <option value="">Skip</option>
                    {store.presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-2"
              onClick={handleLoadSessionFromSlots}
              disabled={store.presets.length === 0}
            >
              Load into tabs
            </button>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <button
              type="button"
              className="btn-ghost text-xs text-muted-foreground hover:text-foreground px-0"
              onClick={() => setMoreStartScheduleOpen((v) => !v)}
            >
              {moreStartScheduleOpen ? "Hide" : "More"}: start or schedule without a new load
            </button>
            {moreStartScheduleOpen && (
              <div className="flex flex-wrap gap-2 items-end pt-1">
                <button type="button" className="btn-primary text-xs px-4 py-2" onClick={handleStartNowClick}>
                  Start now
                </button>
                <div className="flex-1 min-w-[12rem] flex gap-2 items-center">
                  <input
                    type="datetime-local"
                    className="input-field flex-1 text-xs"
                    value={sessionScheduledFor}
                    onChange={(e) => setSessionScheduledFor(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <button
                    type="button"
                    className="btn-primary text-xs px-3 py-2 whitespace-nowrap"
                    onClick={handleScheduleFullSession}
                    disabled={!sessionScheduledFor}
                  >
                    Schedule session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card flex flex-col overflow-hidden flex-1 min-h-0">
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-semibold">Queue</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All scheduled tasks for this session</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border min-h-0">
          {store.scheduledTasks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">No tasks queued</div>
          ) : (
            store.scheduledTasks.map((task) => (
              <div key={task.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{task.presetName}</span>
                    <span className={TASK_STATUS_CLASS[task.status]}>{TASK_STATUS_LABEL[task.status]}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{taskSubtitle(task)}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(task.status === "tokens_ready" ||
                    task.status === "pending" ||
                    task.status === "awaiting_tokens" ||
                    task.status === "failed") && (
                    <button
                      type="button"
                      className="btn-primary text-xs px-2 py-1"
                      onClick={() => onForceStart(task)}
                      title="Force start this task now"
                    >
                      Force start
                    </button>
                  )}
                  {task.status !== "running" && task.status !== "done" && (
                    <button
                      type="button"
                      className="btn-ghost text-xs px-2 text-muted-foreground hover:text-red-400"
                      onClick={() => handleRemoveTask(task.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card flex flex-col overflow-hidden flex-shrink-0">
        <button
          type="button"
          className="px-4 py-2 border-b border-border flex items-center justify-between text-left hover:bg-accent/10"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <span className="text-sm font-medium">Advanced: per-driver queue and presets</span>
          <span className="text-xs text-muted-foreground">{advancedOpen ? "Hide" : "Show"}</span>
        </button>
        {advancedOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-y-auto flex-1 min-h-0">
            <div className="flex flex-col overflow-hidden min-h-0">
              <div className="pb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saved presets</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Load one row at a time</p>
              </div>
              {store.presets.length === 0 ? (
                <div className="flex-1 flex items-center text-muted-foreground text-xs p-2 text-center border border-dashed border-border rounded-md">
                  No presets yet
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-border border border-border rounded-md">
                  {store.presets.map((preset) => (
                    <div key={preset.id} className="p-2 flex items-center gap-2 hover:bg-accent/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{preset.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{formatDate(preset.savedAt)}</div>
                      </div>
                      <select
                        className="input-field text-[10px] py-1 w-24"
                        value={selectedDriverIdx}
                        onChange={(e) => setSelectedDriverIdx(Number(e.target.value))}
                      >
                        {store.drivers.map((_, i) => (
                          <option key={i} value={i}>
                            Drv {i + 1}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary text-[10px] px-2 py-1"
                        onClick={() => handleLoadPreset(preset.id, selectedDriverIdx)}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-[10px] px-1 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDeletePreset(preset.id)}
                      >
                        Del
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col overflow-hidden min-h-0">
              <div className="pb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Per-driver scheduled run
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">Legacy: one driver per task</p>
              </div>
              <div className="space-y-2 p-2 border border-border rounded-md">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-[10px]">Preset</label>
                    <select
                      className="input-field text-xs"
                      value={selectedPresetId}
                      onChange={(e) => setSelectedPresetId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {store.presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label text-[10px]">Driver slot</label>
                    <select
                      className="input-field text-xs"
                      value={selectedDriverIdx}
                      onChange={(e) => setSelectedDriverIdx(Number(e.target.value))}
                    >
                      {store.drivers.map((_, i) => (
                        <option key={i} value={i}>
                          Driver {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label text-[10px]">Run at</label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      className="input-field flex-1 text-xs"
                      value={legacyScheduledFor}
                      onChange={(e) => setLegacyScheduledFor(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    <button
                      type="button"
                      className="btn-primary text-xs px-2"
                      onClick={handleQueueLegacyTask}
                      disabled={!selectedPresetId || !legacyScheduledFor}
                    >
                      Queue
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground px-2">
                Manage and remove tasks in the Queue above.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
