import { useState } from "react";

export interface SessionMeta {
  id: string;
  name: string;
}

interface Props {
  saved: SessionMeta[];
  onRestore: (sessions: SessionMeta[]) => void;
  onFresh: () => void;
}

export function SessionPicker({ saved, onRestore, onFresh }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(saved.map((s) => s.id)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRestore() {
    const sessions = saved.filter((s) => selected.has(s.id));
    if (sessions.length === 0) {
      onFresh();
      return;
    }
    onRestore(sessions);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="card w-full max-w-sm mx-4 shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Welcome back</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select the sessions you want to restore.
          </p>
        </div>

        <div className="px-5 py-4 space-y-2">
          {saved.map((session) => (
            <label
              key={session.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer hover:bg-accent/30 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(session.id)}
                onChange={() => toggle(session.id)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium text-foreground">{session.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">Saved</span>
            </label>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            className="btn-ghost text-xs text-muted-foreground"
            onClick={onFresh}
          >
            Start Fresh
          </button>
          <button
            type="button"
            className="btn-primary text-xs px-5"
            onClick={handleRestore}
            disabled={selected.size === 0}
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
