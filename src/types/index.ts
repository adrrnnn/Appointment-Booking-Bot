export interface HourPrefs {
  tier1: number | null;
  tier2Start: number | null;
  tier2End: number | null;
}

export interface DriverConfig {
  driverName: string;
  bookingTokens: string[];
  licenseNo: string;
  plateCountry: string;
  residentCountry: string;
  vehicleSequenceNumber: string;
  chassisNo: string;
  declaration_number: string;
  plateNo: string;
  hourPrefs: HourPrefs;
}

export type DriverStatus = "idle" | "ready" | "active" | "scheduled" | "invalid" | "done" | "failed";

export interface DriverState extends DriverConfig {
  status: DriverStatus;
  tokenValid: boolean | null;
}

export interface DriverPreset {
  id: string;
  name: string;
  driver: DriverConfig;
  savedAt: number;
}

export interface ScheduledTask {
  id: string;
  presetId: string;
  presetName: string;
  driverIdx: number;
  scheduledFor: number;
  status: "pending" | "awaiting_tokens" | "tokens_ready" | "running" | "done" | "failed";
  freshSearchToken?: string;
  freshBookingTokens?: string[];
}

export type BotEventType = "log" | "status" | "booked" | "failed" | "stopped" | "error" | "ratelimit";

export interface BotEvent {
  type: BotEventType;
  driverIdx?: number;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface BookingResult {
  driverName: string;
  driverIdx: number;
  success: boolean;
  slot?: string;
  reason?: string;
  timestamp: number;
}
