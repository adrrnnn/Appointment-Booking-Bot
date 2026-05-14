import { useState } from "react";
import type { AppStore } from "@/store/appStore";
import type { DriverState, DriverPreset } from "@/types";
import { normalizeDriverConfig } from "@/utils/driverConfig";
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
  const [draft, setDraft] = useState("");
  const [checking, setChecking] = useState(false);
  const [validateMsg, setValidateMsg] = useState<string | null>(null);
  const [validateError, setValidateError] = useState(false);
  /** Trimmed draft that passed the last successful full validate; Add only when this equals current draft.trim() */
  const [validatedDraft, setValidatedDraft] = useState<string | null>(null);

  const draftTrim = draft.trim();
  const canAdd =
    draftTrim.length > 0 &&
    validatedDraft !== null &&
    validatedDraft === draftTrim &&
    !tokens.some((t) => t.trim() === draftTrim);

  function onDraftChange(raw: string) {
    setDraft(raw);
    const t = raw.trim();
    if (validatedDraft !== null && t !== validatedDraft) {
      setValidatedDraft(null);
    }
  }

  function add() {
    if (!canAdd) return;
    onChange([...tokens, draftTrim]);
    setDraft("");
    setValidatedDraft(null);
    setValidateMsg(null);
    setValidateError(false);
  }

  async function validateTokens() {
    const d = draft.trim();
    const listChecks = tokens.map((tok) => tok.trim()).filter(Boolean);

    if (d.length === 0 && listChecks.length === 0) {
      setValidateMsg("Paste a token above, or add tokens to the list first.");
      setValidateError(true);
      setValidatedDraft(null);
      return;
    }

    setChecking(true);
    setValidateMsg(null);
    setValidateError(false);

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
        setValidateMsg(
          d.length > 0 && listChecks.length > 0
            ? `Draft and ${listChecks.length} saved token(s) accepted by the server.`
            : d.length > 0
              ? "Token accepted. You can add it now."
              : `All ${listChecks.length} saved token(s) accepted.`,
        );
        setValidateError(false);
        if (d.length > 0) setValidatedDraft(d);
        else setValidatedDraft(null);
      } else {
        setValidatedDraft(null);
        setValidateMsg(
          `${invalidCount} of ${totalParts} invalid or expired. Fix the token(s) and validate again.`,
        );
        setValidateError(true);
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 min-w-0">
          <label className="label">Paste booking token</label>
          <textarea
            className="input-field w-full font-mono text-xs min-h-[5rem] resize-y py-2"
            placeholder="Paste token, click Validate tokens, then Add"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            className="btn-primary text-xs px-3 h-9"
            disabled={checking}
            onClick={validateTokens}
          >
            {checking ? "Validating…" : "Validate tokens"}
          </button>
          <button
            type="button"
            className="btn-secondary text-xs px-3 h-9 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!canAdd}
            onClick={add}
          >
            Add
          </button>
        </div>
      </div>
      {validateMsg && (
        <p
          className={`text-xs ${
            validateError ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          }`}
        >
          {validateMsg}
        </p>
      )}
      {tokens.length > 0 && (
        <div className="space-y-2">
          {tokens.map((t, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground mb-0.5 block">Token {i + 1}</span>
                <textarea
                  className="input-field w-full font-mono text-xs min-h-[4.5rem] resize-y py-2"
                  value={t}
                  onChange={(e) => {
                    const next = [...tokens];
                    next[i] = e.target.value;
                    onChange(next);
                    setValidatedDraft(null);
                  }}
                  spellCheck={false}
                />
              </div>
              <button
                type="button"
                className="btn-ghost text-xs text-muted-foreground hover:text-red-400 mt-6 flex-shrink-0"
                onClick={() => {
                  onChange(tokens.filter((_, j) => j !== i));
                  setValidateMsg(null);
                  setValidateError(false);
                }}
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
      driver: normalizeDriverConfig(driver),
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
              declaration_number: "",
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        <div className="space-y-3">
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
            <label className="label">License Number</label>
            <input
              className="input-field"
              placeholder="License number"
              value={driver.licenseNo}
              onChange={(e) => update({ licenseNo: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Plate Country</label>
            <CountrySelect
              value={driver.plateCountry}
              onChange={(apiValue) => update({ plateCountry: apiValue })}
            />
          </div>
        </div>
        <div className="space-y-3">
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
            <label className="label">Resident Country</label>
            <CountrySelect
              value={driver.residentCountry}
              onChange={(apiValue) => update({ residentCountry: apiValue })}
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
