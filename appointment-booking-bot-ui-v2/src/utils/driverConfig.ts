import type { DriverConfig, DriverPreset, HourPrefs } from "@/types";

const DEFAULT_HOUR: HourPrefs = { tier1: null, tier2Start: null, tier2End: null };

function optHour(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 23) return null;
  return n;
}

function normalizeHourPrefs(raw: unknown): HourPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_HOUR };
  const h = raw as Record<string, unknown>;
  return {
    tier1: optHour(h.tier1),
    tier2Start: optHour(h.tier2Start),
    tier2End: optHour(h.tier2End),
  };
}

/** Keeps only v14-equivalent driver fields (drops legacy keys like `plateNo`). */
export function normalizeDriverConfig(raw: unknown): DriverConfig {
  if (!raw || typeof raw !== "object") {
    return {
      driverName: "",
      bookingTokens: [],
      licenseNo: "",
      plateCountry: "SA",
      residentCountry: "SA",
      vehicleSequenceNumber: "",
      chassisNo: "",
      declaration_number: "",
      hourPrefs: { ...DEFAULT_HOUR },
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    driverName: typeof o.driverName === "string" ? o.driverName : "",
    bookingTokens: Array.isArray(o.bookingTokens)
      ? o.bookingTokens.filter((t): t is string => typeof t === "string")
      : [],
    licenseNo: typeof o.licenseNo === "string" ? o.licenseNo : "",
    plateCountry: typeof o.plateCountry === "string" ? o.plateCountry : "SA",
    residentCountry: typeof o.residentCountry === "string" ? o.residentCountry : "SA",
    vehicleSequenceNumber: typeof o.vehicleSequenceNumber === "string" ? o.vehicleSequenceNumber : "",
    chassisNo: typeof o.chassisNo === "string" ? o.chassisNo : "",
    declaration_number: typeof o.declaration_number === "string" ? o.declaration_number : "",
    hourPrefs: normalizeHourPrefs(o.hourPrefs),
  };
}

export function normalizeDriverPreset(raw: unknown): DriverPreset {
  if (!raw || typeof raw !== "object") {
    return {
      id: "",
      name: "",
      driver: normalizeDriverConfig(null),
      savedAt: Date.now(),
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    id: typeof o.id === "string" ? o.id : "",
    name: typeof o.name === "string" ? o.name : "",
    savedAt: typeof o.savedAt === "number" ? o.savedAt : Date.now(),
    driver: normalizeDriverConfig(o.driver),
  };
}

export function driverWithBookingTokens(rawDriver: unknown, bookingTokens: string[]): DriverConfig {
  const base = normalizeDriverConfig(rawDriver);
  return { ...base, bookingTokens };
}
