import type { AppStore } from "@/store/appStore";
import type { DriverConfig, DriverPreset, DriverState } from "@/types";
import { SESSION_SCHEDULE_PRESET_ID } from "@/types";
import { normalizeDriverConfig } from "@/utils/driverConfig";

export function sessionSchedulePlaceholderPreset(): DriverPreset {
  return {
    id: SESSION_SCHEDULE_PRESET_ID,
    name: "Full session (all drivers)",
    driver: normalizeDriverConfig(null),
    savedAt: 0,
  };
}

function hasRequiredFields(d: DriverState): boolean {
  return Boolean(
    d.licenseNo.trim() &&
      d.vehicleSequenceNumber.trim() &&
      d.chassisNo.trim() &&
      d.declaration_number.trim() &&
      d.bookingTokens.length > 0 &&
      d.bookingTokens.some((t) => t.trim().length > 0),
  );
}

export function collectReadyDrivers(store: AppStore): DriverConfig[] {
  const out: DriverConfig[] = [];
  for (const d of store.drivers) {
    if (!hasRequiredFields(d)) continue;
    const tokens = d.bookingTokens.map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) continue;
    out.push({
      driverName: d.driverName,
      bookingTokens: tokens,
      licenseNo: d.licenseNo.trim(),
      plateCountry: d.plateCountry.trim() || "SA",
      residentCountry: d.residentCountry.trim() || "SA",
      vehicleSequenceNumber: d.vehicleSequenceNumber.trim(),
      chassisNo: d.chassisNo.trim(),
      declaration_number: d.declaration_number.trim(),
      hourPrefs: { ...d.hourPrefs },
    });
  }
  return out;
}

export function assertAtLeastOneSessionDriver(drivers: DriverConfig[]): string | null {
  if (drivers.length === 0) {
    return "No drivers are ready: each needs license, serial, chassis, declaration, and at least one booking token.";
  }
  return null;
}
