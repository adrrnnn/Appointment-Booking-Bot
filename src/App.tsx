import { useState } from "react";
import { useTheme } from "@/store/useTheme";
import { SessionContainer } from "@/components/SessionContainer";

interface SessionMeta {
  id: string;
  name: string;
}

function makeSession(index: number): SessionMeta {
  return { id: crypto.randomUUID(), name: `Session ${index}` };
}

export function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [sessions, setSessions] = useState<SessionMeta[]>(() => [makeSession(1)]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);

  function addSession() {
    if (sessions.length >= 4) return;
    const next = makeSession(sessions.length + 1);
    setSessions((prev) => [...prev, next]);
    setActiveSessionId(next.id);
  }

  function removeSession(id: string) {
    if (sessions.length <= 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    const next = sessions[idx === 0 ? 1 : idx - 1];
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(next.id);
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Title bar */}
      <div
        className="h-9 flex-shrink-0 flex items-center px-4 gap-3 bg-background border-b border-border"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-xs font-semibold text-muted-foreground tracking-wide select-none">
          APPOINTMENT BOOKING BOT
        </span>

        {/* Session tabs */}
        <div className="flex items-center gap-0.5 flex-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
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
                  onClick={() => removeSession(session.id)}
                  className="pr-2 pl-0 text-xs leading-none opacity-50 hover:opacity-100 transition-opacity"
                  title="Close session"
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

        {/* Theme toggle */}
        <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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

      {/* Session containers - all mounted, only active is visible */}
      {sessions.map((session) => (
        <SessionContainer
          key={session.id}
          sessionId={session.id}
          isActive={session.id === activeSessionId}
        />
      ))}
    </div>
  );
}
