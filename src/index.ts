import * as readlinePromises from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import prompts from "prompts";
import ports from "./ports";
import {
  checkIsLoggedIn,
  commonHeaders,
  setAuthToken,
} from "./auth";

type PortRow = (typeof ports)[number];

const MAX_TRIES = 3000;
const POLL_INTERVAL_MS = 500;
const RATE_LIMIT_BACKOFF_MS = 5000;
const NO_SLOTS_DELAY_MS = 1000;
const PARALLEL_BOOK_COUNT = 5;
// In multi-driver mode, only print a polling status line every N ms to avoid flooding
const MULTI_STATUS_INTERVAL_MS = 5000;

const NIGHT_HOURS = [19, 20, 21, 22, 23];

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function print(color: string, msg: string): void {
  process.stdout.write(`${color}${msg}${c.reset}\n`);
}

let lastStatusLength = 0;
function writeStatus(msg: string): void {
  const padded = msg.padEnd(lastStatusLength, " ");
  lastStatusLength = msg.length;
  process.stdout.write(`\r${c.cyan}${padded}${c.reset}`);
}

function clearStatus(): void {
  process.stdout.write(`\r${" ".repeat(lastStatusLength)}\r`);
  lastStatusLength = 0;
}

interface ScheduleSlot {
  banHour?: boolean;
  zone_schedule_id: string;
  zone_code: string;
  port_code: string;
  schedule_from: string;
  schedule_to: string;
  slot_status: string;
  scheduled_slot: number;
  available_slot: number;
  is_active?: string;
  count_book?: number;
  can_book?: boolean;
  schedule_type?: string;
  schedule_direction?: string;
  land_price_msg?: string;
}

interface ScheduleSuccessResponse {
  schedules?: ScheduleSlot[];
  success: true;
}
interface ScheduleErrorResponse {
  success: false;
  error?: { code: string; message: string }[];
  errors?: { code: string; message: string }[];
  message?: string;
}
type ScheduleResponse = ScheduleSuccessResponse | ScheduleErrorResponse;

const errorMessages = {
  noAppointments: "No schedules available for the selected zone",
  tooManyRequests: "You have exceeded the maximum tries",
  incorrectDeclarationNumber:
    "The transit declaration number is invalid or does not match the selected ports",
};

type HourPrefs = {
  tier1: number | null;
  tier2Start: number | null;
  tier2End: number | null;
};

type DriverArgs = {
  token: string;
  licenseNo: string;
  plateCountry: string;
  residentCountry: string;
  vehicleSequenceNumber: string;
  chassisNo: string;
  declaration_number: string;
  port_code: string;
  hourPrefs: HourPrefs;
};

type DriverEntry = {
  label: string;
  args: DriverArgs;
};

function activePorts(): PortRow[] {
  return ports.filter((p) => p.IS_ACTIVE);
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

function slotHour(slot: ScheduleSlot): number {
  return new Date(slot.schedule_from).getHours();
}

function parseOptionalInt(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return !isNaN(n) && n >= 0 && n <= 23 ? n : null;
}

async function promptPortCode(): Promise<string> {
  const list = activePorts();
  if (list.length === 0) {
    throw new Error("No active ports configured.");
  }

  const response = await prompts(
    {
      type: "select",
      name: "port_code",
      message: "Select port",
      choices: list.map((p) => ({
        title: `${p.PORT_NAME} (${p.PORT_CODE})`,
        value: p.PORT_CODE,
      })),
    },
    {
      onCancel: () => {
        process.exit(130);
      },
    },
  );

  const port_code = response.port_code;
  if (typeof port_code !== "string" || port_code.length === 0) {
    throw new Error("No port selected.");
  }

  if (input.isTTY) {
    try {
      input.setRawMode(false);
    } catch {
      /* ignore */
    }
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
  input.resume();

  return port_code;
}

// Prompts for a session token and validates it. Returns the raw token string.
async function promptAndValidateToken(rl: readlinePromises.Interface, driverLabel: string): Promise<string> {
  console.log(`\nPaste Fasah session token for ${driverLabel}:`);

  let token = "";
  let valid = false;

  while (!valid) {
    token = (await rl.question("AUTH_TOKEN: ")).trim();
    if (!token) {
      console.log("Token is required.\n");
      continue;
    }

    const bearer = /^bearer\s/i.test(token)
      ? token.replace(/^bearer\s+/i, "Bearer ")
      : `Bearer ${token}`;

    setAuthToken(bearer);
    console.log("Validating token...");

    if (await checkIsLoggedIn()) {
      print(c.green, "Token accepted.\n");
      valid = true;
      return bearer;
    } else {
      print(c.red, "Login check failed; paste a fresh token.\n");
    }
  }

  return token;
}

async function collectDriverArgs(
  rl: readlinePromises.Interface,
  driverLabel: string,
  port_code: string,
): Promise<DriverArgs> {
  const ask = async (label: string): Promise<string> => {
    let value = "";
    while (!value) {
      value = (await rl.question(`${label}: `)).trim();
      if (!value) console.log("This field is required.\n");
    }
    return value;
  };

  const declaration_number = await ask("Declaration number");
  const licenseNo = await ask("License number");
  const residentCountry = await ask("Resident country code");
  const plateCountry = await ask("Plate country code");
  const vehicleSequenceNumber = await ask("Vehicle serial number");
  const chassisNo = await ask("Chassis number");

  const rawTier1 = (
    await rl.question("Desired booking hour (0-23, leave blank to skip): ")
  ).trim();
  const tier1 = parseOptionalInt(rawTier1);

  let tier2Start: number | null = null;
  let tier2End: number | null = null;

  const rawT2Start = (
    await rl.question("Fallback window start hour (0-23, leave blank to skip): ")
  ).trim();
  tier2Start = parseOptionalInt(rawT2Start);

  if (tier2Start !== null) {
    const rawT2End = (await rl.question("Fallback window end hour (0-23): ")).trim();
    tier2End = parseOptionalInt(rawT2End);
    if (tier2End === null || tier2End < tier2Start) {
      console.log("Invalid end hour; fallback window disabled.\n");
      tier2Start = null;
      tier2End = null;
    }
  }

  if (tier1 !== null) console.log(`Tier 1 (desired): ${tier1}:00`);
  if (tier2Start !== null && tier2End !== null)
    console.log(`Tier 2 (window):  ${tier2Start}:00 - ${tier2End}:00`);
  console.log(`Tier 3 (fallback): any slot, night hours preferred (19-23)\n`);

  // Token for this driver — not needed for first driver if already logged in
  const token = await promptAndValidateToken(rl, driverLabel);

  return {
    token,
    declaration_number,
    licenseNo,
    plateCountry,
    residentCountry,
    vehicleSequenceNumber,
    chassisNo,
    port_code,
    hourPrefs: { tier1, tier2Start, tier2End },
  };
}

async function collectAllDrivers(): Promise<DriverEntry[]> {
  console.log("Enter appointment and vehicle details (all fields required):\n");

  const port_code = await promptPortCode();

  const rl = readlinePromises.createInterface({ input, output });
  const drivers: DriverEntry[] = [];

  try {
    let adding = true;
    while (adding) {
      const driverNum = drivers.length + 1;
      const label = `Driver ${driverNum}`;
      console.log(`\n--- ${label} ---`);

      const args = await collectDriverArgs(rl, label, port_code);
      drivers.push({ label, args });

      const more = (
        await rl.question("Add another driver? (Y/N): ")
      )
        .trim()
        .toLowerCase();
      adding = more === "y";
    }

    // Summary before launch
    console.log("\n" + "=".repeat(40));
    console.log(`Ready to launch ${drivers.length} bot(s):\n`);
    for (const { label, args } of drivers) {
      const t1 = args.hourPrefs.tier1 !== null ? `${args.hourPrefs.tier1}:00` : "—";
      const t2 =
        args.hourPrefs.tier2Start !== null
          ? `${args.hourPrefs.tier2Start}:00-${args.hourPrefs.tier2End}:00`
          : "—";
      const tokenTail = args.token.slice(-6);
      console.log(
        `  ${label}: License ${args.licenseNo} | Serial ${args.vehicleSequenceNumber} | T1 ${t1} | T2 ${t2} | Token ...${tokenTail}`,
      );
    }
    console.log("=".repeat(40) + "\n");

    let ready = false;
    while (!ready) {
      const confirm = (await rl.question("Press Y to launch all: "))
        .trim()
        .toLowerCase();
      if (confirm === "y") ready = true;
      else console.log("Type Y to begin.\n");
    }
  } finally {
    rl.close();
  }

  return drivers;
}

async function getSchedule({
  port_code = "95",
  token,
}: {
  port_code?: string;
  token: string;
}): Promise<ScheduleResponse | undefined> {
  const scheduleBaseUrl =
    "https://fasah.zatca.gov.sa/api/zatca-tas/v2/zone/schedule/land";

  const response = await fetch(
    `${scheduleBaseUrl}?departure=AGF&arrival=${port_code}&type=TRANSIT&economicOperator=`,
    {
      headers: {
        ...commonHeaders,
        token,
      },
      referrer: "https://fasah.zatca.gov.sa/en/broker/2.0/",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "include",
    },
  );

  if (response.status === 429) {
    throw new Error(errorMessages.tooManyRequests);
  }

  if (!response.ok) {
    throw new Error(`Failed to get schedule: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ScheduleResponse;

  if (data.success === false) {
    const errMsg =
      data.error?.[0]?.message ||
      data.errors?.[0]?.message ||
      data.message ||
      errorMessages.noAppointments;

    if (
      errMsg === errorMessages.noAppointments ||
      errMsg === errorMessages.tooManyRequests ||
      errMsg === errorMessages.incorrectDeclarationNumber
    ) {
      throw new Error(errMsg);
    }

    throw new Error(errorMessages.noAppointments);
  }

  if (!data.schedules || data.schedules.length === 0) {
    throw new Error(errorMessages.noAppointments);
  }

  return data;
}

function sortSlotsByStart(slots: ScheduleSlot[]): ScheduleSlot[] {
  return [...slots].sort(
    (a, b) =>
      new Date(a.schedule_from).getTime() - new Date(b.schedule_from).getTime(),
  );
}

function applyTierFilter(
  slots: ScheduleSlot[],
  prefs: HourPrefs,
): { candidates: ScheduleSlot[]; tier: 1 | 2 | 3 } {
  const sorted = sortSlotsByStart(slots);

  if (prefs.tier1 !== null) {
    const t1 = sorted.filter((s) => slotHour(s) === prefs.tier1);
    if (t1.length > 0) return { candidates: t1, tier: 1 };
  }

  if (prefs.tier2Start !== null && prefs.tier2End !== null) {
    const start = prefs.tier2Start;
    const end = prefs.tier2End;
    const t2 = sorted.filter((s) => {
      const h = slotHour(s);
      return h >= start && h <= end;
    });
    if (t2.length > 0) return { candidates: t2, tier: 2 };
  }

  if (sorted.length === 0) return { candidates: [], tier: 3 };

  const nightSlots = sorted.filter((s) => NIGHT_HOURS.includes(slotHour(s)));
  nightSlots.sort((a, b) => {
    const pa = NIGHT_HOURS.indexOf(slotHour(a));
    const pb = NIGHT_HOURS.indexOf(slotHour(b));
    if (pa !== pb) return pa - pb;
    return new Date(a.schedule_from).getTime() - new Date(b.schedule_from).getTime();
  });
  const otherSlots = sorted.filter((s) => !NIGHT_HOURS.includes(slotHour(s)));
  return { candidates: [...nightSlots, ...otherSlots], tier: 3 };
}

interface FilteredSlots {
  candidates: ScheduleSlot[];
  totalFromApi: number;
  tier: 1 | 2 | 3;
}

async function getFilteredScheduleSlots(
  port_code: string,
  token: string,
  hourPrefs: HourPrefs,
): Promise<FilteredSlots> {
  const schedule = await getSchedule({ port_code, token });
  const all = (schedule as ScheduleSuccessResponse).schedules ?? [];
  const { candidates, tier } = applyTierFilter(all, hourPrefs);
  return { candidates, totalFromApi: all.length, tier };
}

interface BookAppointmentArgs {
  port_code: string;
  zone_schedule_id: string;
  token: string;
  licenseNo: string;
  plateCountry: string;
  residentCountry: string;
  vehicleSequenceNumber: string;
  chassisNo: string;
  declaration_number: string;
  signal?: AbortSignal;
}

async function bookAppointment({
  port_code,
  zone_schedule_id,
  token,
  licenseNo,
  plateCountry,
  residentCountry,
  vehicleSequenceNumber,
  chassisNo,
  declaration_number,
  signal,
}: BookAppointmentArgs): Promise<boolean> {
  const appointmentUrl =
    "https://fasah.zatca.gov.sa/api/zatca-tas/v2/appointment/transit/create";
  const body = {
    port_code,
    zone_schedule_id,
    purpose: "6",
    cargo_type: "",
    fleet_info: [
      {
        licenseNo,
        plateCountry,
        residentCountry,
        vehicleSequenceNumber,
        chassisNo,
      },
    ],
    bayan_appointment: {},
    declaration_number,
  };

  try {
    const response = await fetch(appointmentUrl, {
      headers: {
        ...commonHeaders,
        token,
      },
      referrer: "https://fasah.zatca.gov.sa/en/broker/2.0/",
      body: JSON.stringify(body),
      method: "POST",
      mode: "cors",
      credentials: "include",
      signal,
    });

    if (response.status === 429) {
      throw new Error(errorMessages.tooManyRequests);
    }

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    if (data.success === false) {
      const errMsg =
        data.error?.[0]?.message ||
        data.errors?.[0]?.message ||
        "Unknown error";
      process.stdout.write("\n");
      print(c.red, `Booking rejected: ${errMsg}`);
      return false;
    }

    return true;
  } catch (error) {
    if (isAbortError(error)) return false;
    const msg = (error as Error).message;
    if (msg === errorMessages.tooManyRequests) throw error;
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BookingFields = Omit<BookAppointmentArgs, "port_code" | "zone_schedule_id" | "signal">;

async function bookFirstSuccessfulAmongSlots(
  slots: ScheduleSlot[],
  args: BookingFields,
): Promise<boolean> {
  const slice = slots.slice(0, PARALLEL_BOOK_COUNT);
  if (slice.length === 0) return false;

  if (slice.length === 1) {
    try {
      return await bookAppointment({
        ...args,
        port_code: slice[0].port_code,
        zone_schedule_id: slice[0].zone_schedule_id,
      });
    } catch (e) {
      if ((e as Error).message === errorMessages.tooManyRequests) return false;
      throw e;
    }
  }

  const globalAbort = new AbortController();

  const tasks = slice.map(async (slot) => {
    try {
      const ok = await bookAppointment({
        ...args,
        port_code: slot.port_code,
        zone_schedule_id: slot.zone_schedule_id,
        signal: globalAbort.signal,
      });
      if (ok) globalAbort.abort();
      return { ok, rateLimited: false as const };
    } catch (e) {
      if ((e as Error).message === errorMessages.tooManyRequests) {
        globalAbort.abort();
        return { ok: false, rateLimited: true as const };
      }
      throw e;
    }
  });

  const outcomes = await Promise.all(tasks);
  return outcomes.some((o) => o.ok);
}

function printBookingResult(
  success: boolean,
  args: DriverArgs,
  slot?: ScheduleSlot,
): void {
  const sep = "=".repeat(40);
  console.log(sep);
  print(success ? c.green : c.red, `Booked: ${success ? "true" : "false"}`);
  console.log(`License number:        ${args.licenseNo}`);
  console.log(`Vehicle serial number: ${args.vehicleSequenceNumber}`);
  if (success && slot) {
    console.log(`Slot:                  ${slot.schedule_from}`);
    console.log(`Zone schedule ID:      ${slot.zone_schedule_id}`);
  }
  console.log(sep + "\n");
}

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: "tier 1 (exact hour)",
  2: "tier 2 (window)",
  3: "tier 3 (fallback)",
};

async function runDriver(
  { label, args }: DriverEntry,
  multiMode: boolean,
): Promise<void> {
  const tag = multiMode ? `[${label}] ` : "";

  const log = (color: string, msg: string) => print(color, `${tag}${msg}`);

  // In multi-driver mode, the global status line can't be shared;
  // print a periodic plain-text status instead.
  let lastMultiStatusMs = 0;
  const status = (msg: string) => {
    if (!multiMode) {
      writeStatus(msg);
    } else {
      const now = Date.now();
      if (now - lastMultiStatusMs > MULTI_STATUS_INTERVAL_MS) {
        lastMultiStatusMs = now;
        print(c.cyan, `${tag}${msg}`);
      }
    }
  };

  const clear = () => {
    if (!multiMode) clearStatus();
  };

  const bookingFields: BookingFields = {
    token: args.token,
    licenseNo: args.licenseNo,
    plateCountry: args.plateCountry,
    residentCountry: args.residentCountry,
    vehicleSequenceNumber: args.vehicleSequenceNumber,
    chassisNo: args.chassisNo,
    declaration_number: args.declaration_number,
  };

  let attempt = 0;
  let rateLimitCount = 0;
  let noSlotCount = 0;
  const startTime = Date.now();

  while (attempt < MAX_TRIES) {
    attempt++;

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    status(
      `Polling... attempt ${attempt} | ${elapsed}s elapsed | rate-limited ${rateLimitCount}x | no slots ${noSlotCount}x`,
    );

    let candidates: ScheduleSlot[] = [];
    let totalFromApi = 0;
    let tier: 1 | 2 | 3 = 3;

    try {
      const result = await getFilteredScheduleSlots(args.port_code, args.token, args.hourPrefs);
      candidates = result.candidates;
      totalFromApi = result.totalFromApi;
      tier = result.tier;
    } catch (error) {
      const msg = (error as Error).message;
      if (msg === errorMessages.incorrectDeclarationNumber) {
        clear();
        log(c.red, "Declaration number invalid. Exiting.");
        printBookingResult(false, args);
        return;
      }
      if (msg === errorMessages.tooManyRequests) {
        rateLimitCount++;
        await sleep(RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      noSlotCount++;
      await sleep(NO_SLOTS_DELAY_MS);
      continue;
    }

    if (candidates.length === 0) {
      if (totalFromApi > 0) {
        status(
          `Waiting... ${totalFromApi} slot(s) open but none match preferences — attempt ${attempt} | ${Math.floor((Date.now() - startTime) / 1000)}s`,
        );
      } else {
        noSlotCount++;
      }
      await sleep(NO_SLOTS_DELAY_MS);
      continue;
    }

    clear();

    const head = candidates[0];
    const headHour = slotHour(head);
    log(
      c.yellow,
      `Slots found (${candidates.length}) via ${TIER_LABEL[tier]} — best: ${head.schedule_from} (${headHour}:00) | available: ${head.available_slot}`,
    );
    log(c.yellow, `Booking ${Math.min(candidates.length, PARALLEL_BOOK_COUNT)} slot(s) in parallel...`);

    const booked = await bookFirstSuccessfulAmongSlots(
      candidates.slice(0, PARALLEL_BOOK_COUNT),
      bookingFields,
    );

    if (booked) {
      console.log("");
      printBookingResult(true, args, head);
      return;
    }

    log(c.red, "All booking attempts failed (slots may have been taken). Retrying...\n");
    await sleep(POLL_INTERVAL_MS);
  }

  log(c.red, `Max attempts (${MAX_TRIES}) reached without a successful booking.`);
  printBookingResult(false, args);
}

void (async () => {
  try {
    const drivers = await collectAllDrivers();
    const multiMode = drivers.length > 1;

    if (multiMode) {
      print(c.green, `Launching ${drivers.length} bots simultaneously...\n`);
      await Promise.allSettled(drivers.map((d) => runDriver(d, true)));
    } else {
      await runDriver(drivers[0], false);
    }
  } catch (error) {
    clearStatus();
    print(c.red, `Fatal error: ${(error as Error).message}`);
    process.exit(1);
  }
})();
