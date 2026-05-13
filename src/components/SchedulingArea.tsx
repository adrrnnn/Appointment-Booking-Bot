import { useState } from "react";
import type { AppStore } from "@/store/appStore";
import type { ScheduledTask } from "@/types";

interface Props {
  store: AppStore;
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
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function SchedulingArea({ store }: Props) {
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [selectedDriverIdx, setSelectedDriverIdx] = useState(0);
  const [scheduledFor, setScheduledFor] = useState("");

  function handleLoadPreset(presetId: string, driverIdx: number) {
    const preset = store.presets.find((p) => p.id === presetId);
    if (!preset) return;
    store.loadPreset(preset, driverIdx);
  }

  function handleQueueTask() {
    if (!selectedPresetId || !scheduledFor) return;
    const preset = store.presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      presetId: selectedPresetId,
      presetName: preset.name,
      driverIdx: selectedDriverIdx,
      scheduledFor: new Date(scheduledFor).getTime(),
      status: "pending",
    };
    const updated = [...store.scheduledTasks, task];
    store.setScheduledTasks(updated);
    window.api.saveSchedule(updated);
    setScheduledFor("");
  }

  function handleDeletePreset(id: string) {
    const updated = store.presets.filter((p) => p.id !== id);
    store.setPresets(updated);
    window.api.savePresets(updated);
  }

  function handleRemoveTask(id: string) {
    const updated = store.scheduledTasks.filter((t) => t.id !== id);
    store.setScheduledTasks(updated);
    window.api.saveSchedule(updated);
  }

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Saved Presets */}
      <div className="card flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Saved Presets</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Load a preset to fill driver info automatically</p>
        </div>

        {store.presets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
            No presets saved yet. Fill in a driver tab and click "Save Preset".
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {store.presets.map((preset) => (
              <div key={preset.id} className="p-3 flex items-center gap-3 hover:bg-accent/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{preset.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Saved {formatDate(preset.savedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    className="input-field text-xs py-1 w-28"
                    value={selectedDriverIdx}
                    onChange={(e) => setSelectedDriverIdx(Number(e.target.value))}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <option key={i} value={i}>Driver {i + 1}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-primary text-xs px-2 py-1.5"
                    onClick={() => handleLoadPreset(preset.id, selectedDriverIdx)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs px-2 py-1.5 text-muted-foreground hover:text-red-400"
                    onClick={() => handleDeletePreset(preset.id)}
                  >
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Queue */}
      <div className="card flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Scheduled Runs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Queue a preset to run at a specific time</p>
        </div>

        <div className="p-3 border-b border-border space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Preset</label>
              <select
                className="input-field text-sm"
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
              >
                <option value="">Select preset...</option>
                {store.presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Driver Slot</label>
              <select
                className="input-field text-sm"
                value={selectedDriverIdx}
                onChange={(e) => setSelectedDriverIdx(Number(e.target.value))}
              >
                {[0, 1, 2, 3].map((i) => (
                  <option key={i} value={i}>Driver {i + 1}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Run At</label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                className="input-field flex-1 text-sm"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              <button
                type="button"
                className="btn-primary text-xs px-3"
                onClick={handleQueueTask}
                disabled={!selectedPresetId || !scheduledFor}
              >
                Queue
              </button>
            </div>
          </div>
        </div>

        {store.scheduledTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
            No tasks queued.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {store.scheduledTasks.map((task) => (
              <div key={task.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{task.presetName}</span>
                    <span className={TASK_STATUS_CLASS[task.status]}>{TASK_STATUS_LABEL[task.status]}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Driver {task.driverIdx + 1} - {formatDate(task.scheduledFor)}
                  </div>
                </div>
                {task.status === "pending" && (
                  <button
                    type="button"
                    className="btn-ghost text-xs px-2 text-muted-foreground hover:text-red-400 flex-shrink-0"
                    onClick={() => handleRemoveTask(task.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
