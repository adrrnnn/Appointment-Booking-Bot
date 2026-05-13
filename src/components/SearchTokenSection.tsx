import { useState } from "react";
import type { AppStore } from "@/store/appStore";
import { PORTS } from "@/data/ports";

interface Props {
  store: AppStore;
}

const STATUS_DOT: Record<string, string> = {
  valid: "bg-green-400",
  invalid: "bg-red-400",
  checking: "bg-yellow-400 animate-pulse",
  idle: "bg-muted",
};

export function SearchTokenSection({ store }: Props) {
  const [showToken, setShowToken] = useState(false);

  const statusLabel =
    store.searchTokenChecking ? "Checking..." :
    store.searchTokenValid === true ? "Valid" :
    store.searchTokenValid === false ? "Invalid" :
    "Not checked";

  const dotClass = store.searchTokenChecking ? STATUS_DOT.checking :
    store.searchTokenValid === true ? STATUS_DOT.valid :
    store.searchTokenValid === false ? STATUS_DOT.invalid :
    STATUS_DOT.idle;

  async function handleValidate() {
    if (!store.searchToken.trim()) return;
    store.setSearchTokenChecking(true);
    store.setSearchTokenValid(null);
    try {
      const result = await window.api.validateToken(store.searchToken.trim());
      store.setSearchTokenValid(result.valid);
    } finally {
      store.setSearchTokenChecking(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex-1 min-w-0">
            <label className="label">Search Token</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? "text" : "password"}
                  className="input-field pr-10 font-mono text-xs"
                  placeholder="Paste your search token here..."
                  value={store.searchToken}
                  onChange={(e) => {
                    store.setSearchToken(e.target.value);
                    store.setSearchTokenValid(null);
                  }}
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs"
                  tabIndex={-1}
                >
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                <span className="text-muted-foreground text-xs">{statusLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <label className="label">Port</label>
          <select
            className="input-field w-52"
            value={store.portCode}
            onChange={(e) => store.setPortCode(e.target.value)}
          >
            {PORTS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 flex-shrink-0 pb-0.5">
          <button
            type="button"
            className="btn-primary"
            onClick={handleValidate}
            disabled={!store.searchToken.trim() || store.searchTokenChecking}
          >
            {store.searchTokenChecking ? "Checking..." : "Validate"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              store.setSearchToken("");
              store.setSearchTokenValid(null);
              store.clearLogs();
            }}
          >
            Clear Session
          </button>
        </div>
      </div>
    </div>
  );
}
