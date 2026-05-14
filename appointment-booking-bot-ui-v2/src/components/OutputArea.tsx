import type { AppStore } from "@/store/appStore";

interface Props {
  store: AppStore;
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function OutputArea({ store }: Props) {
  const booked = store.results.filter((r) => r.success);
  const failed = store.results.filter((r) => !r.success);

  if (store.results.length === 0) {
    return (
      <div className="card p-6 text-center text-muted-foreground text-sm">
        Booking results will appear here once the bot starts.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-4">
        <h3 className="text-sm font-semibold">Booking Results</h3>
        <div className="flex items-center gap-3 ml-2">
          <span className="badge-done">{booked.length} booked</span>
          {failed.length > 0 && (
            <span className="badge-failed">{failed.length} failed</span>
          )}
        </div>
        <button
          type="button"
          className="btn-ghost text-xs text-muted-foreground ml-auto"
          onClick={() => store.setResults([])}
        >
          Clear
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Driver</th>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Status</th>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Slot / Reason</th>
              <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {store.results.map((result, i) => (
              <tr key={i} className="hover:bg-accent/10 transition-colors">
                <td className="px-4 py-2.5 font-medium">{result.driverName}</td>
                <td className="px-4 py-2.5">
                  {result.success ? (
                    <span className="badge-done">Booked</span>
                  ) : (
                    <span className="badge-failed">Failed</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {result.success ? (result.slot ?? "-") : (result.reason ?? "Slots taken")}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                  {formatTs(result.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
