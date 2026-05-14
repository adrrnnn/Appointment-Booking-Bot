import { useCallback, useState } from "react";
import { useTheme } from "@/store/useTheme";
import { SessionContainer } from "@/components/SessionContainer";
import { SessionPicker } from "@/components/SessionPicker";
import type { SessionMeta } from "@/components/SessionPicker";

const REGISTRY_KEY = "session-registry";

function makeSession(index: number): SessionMeta {
  return { id: `session-${index}`, name: `Session ${index}` };
}

function saveRegistry(sessions: SessionMeta[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(sessions));
}

function loadRegistry(): SessionMeta[] | null {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as SessionMeta[];
  } catch {
    return null;
  }
}

export function App() {
  const { theme, toggle: toggleTheme } = useTheme();

  const saved = loadRegistry();
  const [showPicker, setShowPicker] = useState<boolean>(!!saved);
  const [sessions, setSessions] = useState<SessionMeta[]>(() =>
    saved ? [] : [makeSession(1)],
  );
  const [activeSessionId, setActiveSessionId] = useState<string>(() =>
    saved ? "" : "session-1",
  );

  function handleRestore(selected: SessionMeta[]) {
    setSessions(selected);
    setActiveSessionId(selected[0].id);
    setShowPicker(false);
  }

  function handleFresh() {
    const fresh = [makeSession(1)];
    setSessions(fresh);
    setActiveSessionId("session-1");
    saveRegistry(fresh);
    setShowPicker(false);
  }

  function addSession() {
    if (sessions.length >= 4) return;
    const next = makeSession(sessions.length + 1);
    const updated = [...sessions, next];
    setSessions(updated);
    setActiveSessionId(next.id);
    saveRegistry(updated);
  }

  function removeSession(id: string) {
    if (sessions.length <= 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    const next = sessions[idx === 0 ? 1 : idx - 1];
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    if (activeSessionId === id) setActiveSessionId(next.id);
    saveRegistry(updated);
  }

  const [sessionBotRunning, setSessionBotRunning] = useState<Record<string, boolean>>({});

  const onBotRunningChange = useCallback((id: string, running: boolean) => {
    setSessionBotRunning((prev) => (prev[id] === running ? prev : { ...prev, [id]: running }));
  }, []);

  function tryCloseSession(id: string, name: string) {
    if (sessionBotRunning[id]) {
      alert(`Stop the bot in ${name} before closing this session.`);
      return;
    }
    if (!window.confirm(`Close ${name}? Unsaved driver info will be lost.`)) return;
    if (!window.confirm(`Last check: close session tab "${name}"? This cannot be undone.`)) return;
    setSessionBotRunning((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    removeSession(id);
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Session picker overlay on launch */}
      {showPicker && saved && (
        <SessionPicker
          saved={saved}
          onRestore={handleRestore}
          onFresh={handleFresh}
        />
      )}

      {/* Title bar */}
      <div
        className="h-9 flex-shrink-0 flex items-center px-4 gap-3 bg-background border-b border-border"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-xs font-semibold text-muted-foreground tracking-wide select-none">
          APPOINTMENT BOOKING BOT
        </span>

        {/* Session tabs */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center rounded-md transition-colors ${
                activeSessionId === session.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveSessionId(session.id)}
                className="px-3 py-1 text-xs font-medium"
              >
                {session.name}
              </button>
              {sessions.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    tryCloseSession(session.id, session.name);
                  }}
                  title="Close session"
                  className="pr-2 pl-0.5 py-1 text-muted-foreground hover:text-red-400 transition-colors text-xs leading-none"
                >
                  x
                </button>
              )}
            </div>
          ))}

          {sessions.length < 4 && (
            <button
              type="button"
              onClick={addSession}
              title="Add session"
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-base font-light flex-shrink-0"
            >
              +
            </button>
          )}
        </div>

      </div>

      {/* Session containers - all mounted, only active is visible */}
      {sessions.map((session) => (
        <SessionContainer
          key={session.id}
          sessionId={session.id}
          isActive={session.id === activeSessionId}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBotRunningChange={onBotRunningChange}
        />
      ))}
    </div>
  );
}
