import { useState } from "react";
import type { AppStore } from "@/store/appStore";
import { DriverPanel } from "./DriverPanel";

interface Props {
  store: AppStore;
}

const STATUS_DOT_CLASS: Record<string, string> = {
  idle: "text-muted-foreground",
  ready: "text-blue-400",
  active: "text-green-400",
  scheduled: "text-yellow-400",
  invalid: "text-red-400",
  done: "text-green-400",
  failed: "text-red-400",
};

export function DriverTabs({ store }: Props) {
  const [activeTab, setActiveTab] = useState(0);

  function handleRemove(idx: number) {
    store.removeDriver(idx);
    if (activeTab >= idx && activeTab > 0) {
      setActiveTab(activeTab - 1);
    }
  }

  function handleAdd() {
    store.addDriver();
    setActiveTab(store.drivers.length);
  }

  const safeActive = Math.min(activeTab, store.drivers.length - 1);

  return (
    <div className="card flex flex-col overflow-hidden h-full">
      <div className="flex items-center border-b border-border bg-background/50">
        {store.drivers.map((driver, i) => (
          <div
            key={i}
            className={`flex items-center border-b-2 -mb-px ${
              safeActive === i ? "border-primary" : "border-transparent"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                safeActive === i ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{driver.driverName || `Driver ${i + 1}`}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 ${STATUS_DOT_CLASS[driver.status] ?? "text-muted-foreground"}`}
              />
            </button>
            {store.drivers.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemove(i)}
                title="Remove driver"
                className="pr-3 pl-0.5 py-3 text-muted-foreground hover:text-red-400 transition-colors text-xs leading-none"
              >
                x
              </button>
            )}
          </div>
        ))}

        {store.drivers.length < 4 && (
          <button
            type="button"
            onClick={handleAdd}
            title="Add driver"
            className="flex items-center justify-center w-9 h-9 ml-1 my-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-lg font-light flex-shrink-0"
          >
            +
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {store.drivers[safeActive] && (
          <DriverPanel
            key={safeActive}
            idx={safeActive}
            driver={store.drivers[safeActive]}
            store={store}
          />
        )}
      </div>
    </div>
  );
}
