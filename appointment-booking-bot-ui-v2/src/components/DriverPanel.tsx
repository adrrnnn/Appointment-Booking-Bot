import { useState } from "react";
import type { AppStore } from "@/store/appStore";
import type { DriverState, DriverPreset } from "@/types";
import { CountrySelect } from "./CountrySelect";

interface Props {
  idx: number;
  driver: DriverState;
  store: AppStore;
  sessionId: string;
}

const STATUS_LABELS: Record<DriverState["status"], string> = {
  idle: "Idle",
  ready: "Ready",
  active: "Active",
  scheduled: "Scheduled",
  invalid: "Invalid",
  done: "Done",
  failed: "Failed",
};

function TokenList({ tokens, onChange }: { tokens: string[]; onChange: (tokens: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim();
    if (!t || tokens.includes(t)) return;
    onChange([...tokens, t]);
    setInput("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="password"
          className="input-field flex-1 font-mono text-xs"
          placeholder="Paste booking token and press Add"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          spellCheck={false}
        />
        <button type="button" className="btn-secondary text-xs px-3" onClick={add}>
          Add
        </button>
      </div>
      {tokens.length > 0 && (
        <div className="space-y-1">
          {tokens.map((t, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs font-mono">
              <span className="text-muted-foreground">Token {i + 1}</span>
              <span className="flex-1 truncate text-foreground">{"*".repeat(12)}{t.slice(-6)}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-red-400 transition-colors text-xs"
                onClick={() => onChange(tokens.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DriverPanel({ idx, driver, store, sessionId }: Props) {
  const [savePresetName, setSavePresetName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  function update(patch: Partial<DriverState>) {
    store.updateDriver(idx, patch);
  }

  function handleSavePreset() {
    const name = savePresetName.trim() || driver.driverName || `Driver ${idx + 1}`;
    const preset: DriverPreset = {
      id: crypto.randomUUID(),
      name,
      driver: {
        driverName: driver.driverName,
        bookingTokens: driver.bookingTokens,
        licenseNo: driver.licenseNo,
        plateCountry: driver.plateCountry,
        residentCountry: driver.residentCountry,
        vehicleSequenceNumber: driver.vehicleSequenceNumber,
        chassisNo: driver.chassisNo,
        declaration_number: driver.declaration_number,
        plateNo: driver.plateNo,
        hourPrefs: driver.hourPrefs,
      },
      savedAt: Date.now(),
    };
    const updated = [...store.presets, preset];
    store.setPresets(updated);
    window.api.savePresets(sessionId, updated);
    setSavePresetName("");
    setShowSaveForm(false);
  }

  function isReady(): boolean {
    return !!(
      driver.driverName &&
      driver.bookingTokens.length > 0 &&
      driver.licenseNo &&
      driver.plateCountry &&
      driver.residentCountry &&
      driver.vehicleSequenceNumber &&
      driver.chassisNo &&
      driver.declaration_number
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">Driver {idx + 1}</h3>
          <span className={`badge-${driver.status}`}>{STATUS_LABELS[driver.status]}</span>
          {isReady() && driver.status === "idle" && (
            <span className="badge-ready">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => setShowSaveForm((s) => !s)}
          >
            Save Preset
          </button>
          <button
            type="button"
            className="btn-ghost text-xs text-muted-foreground"
            onClick={() => store.updateDriver(idx, {
              driverName: "", bookingTokens: [], licenseNo: "",
              plateCountry: "SA", residentCountry: "SA",
              vehicleSequenceNumber: "", chassisNo: "",
              declaration_number: "", plateNo: "",
              hourPrefs: { tier1: null, tier2Start: null, tier2End: null },
              status: "idle", tokenValid: null,
            })}
          >
            Clear
          </button>
        </div>
      </div>

      {showSaveForm && (
        <div className="flex gap-2 bg-accent/30 rounded-md p-2 border border-border">
          <input
            className="input-field flex-1 text-xs"
            placeholder={driver.driverName || `Preset ${idx + 1}`}
            value={savePresetName}
            onChange={(e) => setSavePresetName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); }}
          />
          <button type="button" className="btn-primary text-xs px-3" onClick={handleSavePreset}>
            Save
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={() => setShowSaveForm(false)}>
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Display Name</label>
          <input
            className="input-field"
            placeholder="John Doe"
            value={driver.driverName}
            onChange={(e) => update({ driverName: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Declaration Number</label>
          <input
            className="input-field font-mono text-xs"
            placeholder="Enter declaration number"
            value={driver.declaration_number}
            onChange={(e) => update({ declaration_number: e.target.value })}
          />
        </div>
        <div>
          <label className="label">License Number</label>
          <input
            className="input-field"
            placeholder="License number"
            value={driver.licenseNo}
            onChange={(e) => update({ licenseNo: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Plate Number</label>
          <input
            className="input-field"
            placeholder="Plate number"
            value={driver.plateNo}
            onChange={(e) => update({ plateNo: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Resident Country</label>
          <CountrySelect
            value={driver.residentCountry}
            onChange={(apiValue) => update({ residentCountry: apiValue })}
          />
        </div>
        <div>
          <label className="label">Plate Country</label>
          <CountrySelect
            value={driver.plateCountry}
            onChange={(apiValue) => update({ plateCountry: apiValue })}
          />
        </div>
        <div>
          <label className="label">Vehicle Serial Number</label>
          <input
            className="input-field"
            placeholder="Vehicle serial number"
            value={driver.vehicleSequenceNumber}
            onChange={(e) => update({ vehicleSequenceNumber: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Chassis Number</label>
          <input
            className="input-field"
            placeholder="Chassis number"
            value={driver.chassisNo}
            onChange={(e) => update({ chassisNo: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="label">Booking Tokens ({driver.bookingTokens.length} added)</label>
        <TokenList
          tokens={driver.bookingTokens}
          onChange={(tokens) => update({ bookingTokens: tokens })}
        />
      </div>

      <div>
        <label className="label">Hour Preferences</label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Tier 1 (exact hour)</span>
            <input
              type="number"
              min={0}
              max={23}
              className="input-field text-sm"
              placeholder="e.g. 9"
              value={driver.hourPrefs.tier1 ?? ""}
              onChange={(e) => update({ hourPrefs: { ...driver.hourPrefs, tier1: e.target.value ? parseInt(e.target.value) : null } })}
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Tier 2 start</span>
            <input
              type="number"
              min={0}
              max={23}
              className="input-field text-sm"
              placeholder="e.g. 7"
              value={driver.hourPrefs.tier2Start ?? ""}
              onChange={(e) => update({ hourPrefs: { ...driver.hourPrefs, tier2Start: e.target.value ? parseInt(e.target.value) : null } })}
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground mb-1 block">Tier 2 end</span>
            <input
              type="number"
              min={0}
              max={23}
              className="input-field text-sm"
              placeholder="e.g. 12"
              value={driver.hourPrefs.tier2End ?? ""}
              onChange={(e) => update({ hourPrefs: { ...driver.hourPrefs, tier2End: e.target.value ? parseInt(e.target.value) : null } })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
