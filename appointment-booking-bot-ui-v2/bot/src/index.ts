import * as readlinePromises from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as fs from "node:fs";
import * as path from "node:path";
import prompts from "prompts";
import ports from "./ports";
import {
  checkIsLoggedIn,
  commonHeaders,
  setAuthToken,
} from "./auth";

type PortRow = (typeof ports)[number];

const VERSION = "14.1";

const MAX_TRIES = 3000;
const POLL_INTERVAL_MS = 500;
const RATE_LIMIT_BACKOFF_MS = 5000;
const NO_SLOTS_DELAY_MS = 1_000;
const PARALLEL_BOOK_COUNT = 5;
const MULTI_STATUS_INTERVAL_MS = 5000;
const BOOKING_COOLDOWN_FALLBACK_MS = 15_000;
const MIN_BOOKING_COOLDOWN_MS = 2_000;
const MAX_BOOKING_COOLDOWN_MS = 34_999;
const BOOKING_VAGUE_MINUTE_COOLDOWN_MS = 20_000;
const BOOKING_POST_WINDOW_MS = 60_000;
const BOOKING_POST_MAX_PER_WINDOW = 10;
const JITTER_POLL_MS = 100;
const JITTER_NO_SLOTS_MS = 200;
const JITTER_RATE_LIMIT_MS = 400;
const SCHEDULE_429_MIN_BACKOFF_MS = 1_000;
const SCHEDULE_429_MAX_BACKOFF_MS = 10_000;
const SECTION_WIDTH = 40;

const NIGHT_HOURS = [19, 20, 21, 22, 23];

const REGEX_RATE_LIMIT = /rate limit/i;
const REGEX_WAIT_MINUTE = /wait for a minute/i;
const REGEX_BOOKING_SECONDS = /(\d+)\s*(?:sec|seconds?)/i;
const REGEX_MINUTE_PHRASE = /\ba minute\b|one minute|try again in (?:a |one )?minute/i;

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  prompt: "\x1b[36m",
};

const LOG_PATH = path.join(process.cwd(), "bot.log");
const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });

function logTs(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function logToFile(msg: string): void {
  logStream.write(`[${logTs()}] ${msg}\n`);
}

function printRule(): void {
  console.log("=".repeat(SECTION_WIDTH));
}

function print(color: string, msg: string): void {
  process.stdout.write(`${color}${msg}${c.reset}\n`);
  logToFile(msg);
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
  _parsedFromMs?: number;
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
  bookingRateLimited: "__booking_rate_limited__",
};

function isBookingRateLimitMessage(msg: string): boolean {
  return REGEX_RATE_LIMIT.test(msg) || REGEX_WAIT_MINUTE.test(msg);
}

function parseRetryAfterMs(res: Response, now = Date.now()): number | undefined {
  const raw = res.headers.get("retry-after")?.trim();
  if (!raw) return undefined;
  const secs = parseInt(raw, 10);
  if (!Number.isNaN(secs)) return secs * 1000;
  const until = Date.parse(raw);
  if (!Number.isNaN(until)) return Math.max(0, until - now);
  return undefined;
}

function cooldownMsFromBookingMessage(msg: string): number | undefined {
  const m = msg.match(REGEX_BOOKING_SECONDS);
  if (m) return parseInt(m[1]!, 10) * 1000;
  if (REGEX_MINUTE_PHRASE.test(msg)) {
    return BOOKING_VAGUE_MINUTE_COOLDOWN_MS;
  }
  return undefined;
}

function clampBookingCooldownMs(ms: number): number {
  return Math.min(
    MAX_BOOKING_COOLDOWN_MS,
    Math.max(MIN_BOOKING_COOLDOWN_MS, Math.ceil(ms)),
  );
}

function throwBookingRateLimited(res: Response, errMsgForBody: string): never {
  const fromHeader = parseRetryAfterMs(res);
  const fromBody = cooldownMsFromBookingMessage(errMsgForBody);
  const ms = clampBookingCooldownMs(
    fromHeader ?? fromBody ?? BOOKING_COOLDOWN_FALLBACK_MS,
  );
  const e = new Error(errorMessages.bookingRateLimited);
  (e as Error & { retryAfterMs: number }).retryAfterMs = ms;
  throw e;
}

function getBookingCooldownMs(err: unknown): number {
  const e = err as Error & { retryAfterMs?: unknown };
  if (typeof e.retryAfterMs === "number" && Number.isFinite(e.retryAfterMs)) {
    return clampBookingCooldownMs(e.retryAfterMs);
  }
  return clampBookingCooldownMs(BOOKING_COOLDOWN_FALLBACK_MS);
}

function throwScheduleRateLimited(response: Response): never {
  const ra = parseRetryAfterMs(response);
  const ms =
    ra !== undefined
      ? Math.min(
          Math.max(ra, SCHEDULE_429_MIN_BACKOFF_MS),
          SCHEDULE_429_MAX_BACKOFF_MS,
        )
      : RATE_LIMIT_BACKOFF_MS;
  const e = new Error(errorMessages.tooManyRequests);
  (e as Error & { scheduleBackoffMs: number }).scheduleBackoffMs = ms;
  throw e;
}

function getScheduleBackoffMs(err: unknown): number {
  const e = err as Error & { scheduleBackoffMs?: unknown };
  if (
    typeof e.scheduleBackoffMs === "number" &&
    Number.isFinite(e.scheduleBackoffMs)
  ) {
    return Math.max(
      SCHEDULE_429_MIN_BACKOFF_MS,
      Math.ceil(e.scheduleBackoffMs),
    );
  }
  return RATE_LIMIT_BACKOFF_MS;
}

function jitteredDelayMs(base: number, jitterMax: number): number {
  if (base <= 0) return 0;
  return base + Math.floor(Math.random() * (jitterMax + 1));
}

type HourPrefs = {
  tier1: number | null;
  tier2Start: number | null;
  tier2End: number | null;
};

type DriverArgs = {
  driverName: string;
  bookingTokens: string[];
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

type SetupResult = {
  searchToken: string;
  port_code: string;
  drivers: DriverEntry[];
};

function activePorts(): PortRow[] {
  return ports.filter((p) => p.IS_ACTIVE);
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

function slotHour(slot: ScheduleSlot): number {
  slot._parsedFromMs ??= new Date(slot.schedule_from).getTime();
  return new Date(slot._parsedFromMs).getHours();
}

function formatScheduleFromRiyadh(scheduleFrom: string): string {
  const ms = Date.parse(scheduleFrom);
  if (Number.isNaN(ms)) return scheduleFrom;
  const d = new Date(ms);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

function parseOptionalInt(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return !isNaN(n) && n >= 0 && n <= 23 ? n : null;
}

function possessiveLabel(name: string): string {
  const t = name.trim();
  if (!t) return "Driver";
  return t.endsWith("s") || t.endsWith("S") ? `${t}'` : `${t}'s`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function sleepWithJitter(
  baseMs: number,
  jitterMax: number,
): Promise<void> {
  await sleep(jitteredDelayMs(baseMs, jitterMax));
}


class BookingPostBudget {
  private readonly timestamps: number[] = new Array(BOOKING_POST_MAX_PER_WINDOW);
  private head = 0;
  private count = 0;
  private chain: Promise<void> = Promise.resolve();

  take(): Promise<void> {
    const p = this.chain.then(() => this.takeSerial());
    this.chain = p.catch(() => {});
    return p;
  }

  private async takeSerial(): Promise<void> {
    for (;;) {
      const now = Date.now();
      if (this.count === BOOKING_POST_MAX_PER_WINDOW) {
        const oldest = this.timestamps[this.head]!;
        if (now - oldest < BOOKING_POST_WINDOW_MS) {
          const waitMs = BOOKING_POST_WINDOW_MS - (now - oldest) + 25;
          await sleep(Math.min(Math.max(waitMs, 50), BOOKING_POST_WINDOW_MS));
          continue;
        }
        this.head = (this.head + 1) % BOOKING_POST_MAX_PER_WINDOW;
        this.count--;
      }
      this.timestamps[(this.head + this.count) % BOOKING_POST_MAX_PER_WINDOW] = now;
      this.count++;
      return;
    }
  }
}

const bookingBudgetByToken = new Map<string, BookingPostBudget>();

function bookingBudgetForToken(token: string): BookingPostBudget {
  let b = bookingBudgetByToken.get(token);
  if (!b) {
    b = new BookingPostBudget();
    bookingBudgetByToken.set(token, b);
  }
  return b;
}

function readHiddenLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    if (!input.isTTY || typeof input.setRawMode !== "function") {
      resolve("");
      return;
    }
    output.write(prompt);
    input.setRawMode(true);
    let line = "";
    const finish = () => {
      input.setRawMode(false);
      input.removeListener("data", onData);
      output.write("\n");
      resolve(line.trim());
    };
    const onData = (buf: Buffer) => {
      const s = buf.toString("utf8");
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code === 13 || code === 10) {
          finish();
          return;
        }
        if (code === 3) {
          process.exit(130);
        }
        if (code === 127 || code === 8) {
          if (line.length > 0) {
            line = line.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }
        line += s[i]!;
      }
    };
    input.on("data", onData);
  });
}

function useHiddenTokenInput(): boolean {
  return (
    process.platform !== "win32" &&
    input.isTTY &&
    typeof input.setRawMode === "function"
  );
}

async function readTokenLine(
  rl: readlinePromises.Interface,
  prompt: string,
): Promise<string> {
  if (!useHiddenTokenInput()) {
    return (await rl.question(prompt)).trim();
  }
  rl.pause();
  try {
    return await readHiddenLine(prompt);
  } finally {
    rl.resume();
  }
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
    } catch {}
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
  input.resume();

  return port_code;
}

function normalizeBearer(raw: string): string {
  const t = raw.trim();
  return /^bearer\s/i.test(t)
    ? t.replace(/^bearer\s+/i, "Bearer ")
    : `Bearer ${t}`;
}

async function validateToken(
  rl: readlinePromises.Interface,
  label: string,
  promptLabel: string,
): Promise<string> {
  printRule();
  print(c.dim, label);
  if (useHiddenTokenInput()) {
    process.stdout.write(`${c.dim}Hidden input. Paste, then Enter.${c.reset}\n`);
  } else {
    process.stdout.write(
      `${c.dim}Paste at ${promptLabel} below (visible in this console), then Enter.${c.reset}\n`,
    );
  }

  for (;;) {
    const raw = await readTokenLine(
      rl,
      `${c.prompt}${promptLabel}${c.reset}: `,
    );
    const token = raw.trim();
    if (!token) {
      print(c.red, "Token is required.");
      continue;
    }

    const bearer = normalizeBearer(token);
    setAuthToken(bearer);
    print(c.dim, "Validating token...");

    if (await checkIsLoggedIn()) {
      print(c.green, `Token accepted (tail ${bearer.slice(-6)})`);
      return bearer;
    }
    print(c.red, "Login check failed. Paste a fresh token.");
  }
}

async function collectBookingTokens(
  rl: readlinePromises.Interface,
  driverName: string,
): Promise<string[]> {
  const tokens: string[] = [];
  let adding = true;
  let idx = 1;
  while (adding) {
    const bearer = await validateToken(
      rl,
      `${driverName}: booking token ${idx}`,
      `BOOKING_TOKEN_${idx}`,
    );
    tokens.push(bearer);
    idx++;
    const more = (
      await rl.question(`${c.prompt}Add another booking token? (Y/N):${c.reset} `)
    )
      .trim()
      .toLowerCase();
    adding = more === "y";
  }
  return tokens;
}

async function collectDriverArgs(
  rl: readlinePromises.Interface,
  ordinalLabel: string,
  port_code: string,
): Promise<DriverArgs> {
  const ask = async (label: string): Promise<string> => {
    let value = "";
    while (!value) {
      value = (
        await rl.question(`${c.prompt}${label}:${c.reset} `)
      ).trim();
      if (!value) print(c.dim, "This field is required.");
    }
    return value;
  };

  printRule();
  print(
    c.dim,
    `${ordinalLabel}: display name (for your logs only; not sent to the server)`,
  );
  const driverName = await ask("Driver display name");

  printRule();
  print(c.dim, `${driverName}: vehicle and declaration`);

  const declaration_number = await ask("Declaration number");
  const licenseNo = await ask("License number");
  const residentCountry = await ask("Resident country code");
  const plateCountry = await ask("Plate country code");
  const vehicleSequenceNumber = await ask("Vehicle serial number");
  const chassisNo = await ask("Chassis number");

  printRule();
  print(c.dim, `${driverName}: hour preferences`);

  const rawTier1 = (
    await rl.question(
      `${c.prompt}Desired booking hour (0-23, leave blank to skip):${c.reset} `,
    )
  ).trim();
  const tier1 = parseOptionalInt(rawTier1);

  let tier2Start: number | null = null;
  let tier2End: number | null = null;

  const rawT2Start = (
    await rl.question(
      `${c.prompt}Backup window start hour (0-23, leave blank to skip):${c.reset} `,
    )
  ).trim();
  tier2Start = parseOptionalInt(rawT2Start);

  if (tier2Start !== null) {
    const rawT2End = (
      await rl.question(`${c.prompt}Backup window end hour (0-23):${c.reset} `)
    ).trim();
    tier2End = parseOptionalInt(rawT2End);
    if (tier2End === null || tier2End < tier2Start) {
      print(c.dim, "Invalid end hour. Backup window cleared.");
      tier2Start = null;
      tier2End = null;
    }
  }

  if (tier1 !== null) console.log(`${c.dim}Tier 1 (desired): ${tier1}:00${c.reset}`);
  if (tier2Start !== null && tier2End !== null) {
    console.log(`${c.dim}Tier 2 (backup): ${tier2Start}:00 - ${tier2End}:00${c.reset}`);
  }
  console.log(
    `${c.dim}Tier 3: night hours preferred (19-23), then others${c.reset}\n`,
  );

  const bookingTokens = await collectBookingTokens(rl, driverName);

  return {
    driverName,
    bookingTokens,
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

async function collectSetup(): Promise<SetupResult> {
  printRule();
  process.stdout.write(`${c.bold}Appointment setup${c.reset}\n`);
  print(c.dim, "All fields required.\n");

  const port_code = await promptPortCode();
  printRule();
  console.log(`${c.dim}Port code:${c.reset} ${port_code}\n`);

  const rl = readlinePromises.createInterface({ input, output });
  const drivers: DriverEntry[] = [];
  let searchToken = "";

  try {
    searchToken = await validateToken(
      rl,
      "Search token (used for finding slots only)",
      "SEARCH_TOKEN",
    );

    let adding = true;
    while (adding) {
      const driverNum = drivers.length + 1;
      const label = `Driver ${driverNum}`;
      printRule();
      process.stdout.write(`${c.bold}${label}${c.reset}\n`);

      const args = await collectDriverArgs(rl, label, port_code);
      drivers.push({ label: args.driverName, args });

      const more = (
        await rl.question(`${c.prompt}Add another driver? (Y/N):${c.reset} `)
      )
        .trim()
        .toLowerCase();
      adding = more === "y";
    }

    printRule();
    console.log(`${c.bold}Ready to launch ${drivers.length} bot(s)${c.reset}\n`);
    console.log(`  Search token: ...${searchToken.slice(-6)}`);
    for (const { args } of drivers) {
      const t1 = args.hourPrefs.tier1 !== null ? `${args.hourPrefs.tier1}:00` : "-";
      const t2 =
        args.hourPrefs.tier2Start !== null
          ? `${args.hourPrefs.tier2Start}:00-${args.hourPrefs.tier2End}:00`
          : "-";
      const tails = args.bookingTokens.map((t) => `...${t.slice(-6)}`).join(", ");
      console.log(
        `  ${args.driverName}: license ${args.licenseNo} | serial ${args.vehicleSequenceNumber} | T1 ${t1} | T2 ${t2} | booking x${args.bookingTokens.length} (${tails})`,
      );
    }
    printRule();
    console.log("");

    let ready = false;
    while (!ready) {
      const confirm = (
        await rl.question(`${c.prompt}Press Y to launch all:${c.reset} `)
      )
        .trim()
        .toLowerCase();
      if (confirm === "y") ready = true;
      else print(c.dim, "Type Y to begin.");
    }
  } finally {
    rl.close();
  }

  return { searchToken, port_code, drivers };
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
    throwScheduleRateLimited(response);
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
  return [...slots].sort((a, b) => {
    a._parsedFromMs ??= new Date(a.schedule_from).getTime();
    b._parsedFromMs ??= new Date(b.schedule_from).getTime();
    return a._parsedFromMs - b._parsedFromMs;
  });
}

function applyTierFilter(
  slots: ScheduleSlot[],
  prefs: HourPrefs,
): { candidates: ScheduleSlot[]; tier: 1 | 2 | 3 } {
  const sorted = sortSlotsByStart(slots);
  if (sorted.length === 0) return { candidates: [], tier: 3 };

  const t1: ScheduleSlot[] = [];
  const t2: ScheduleSlot[] = [];
  const rest: ScheduleSlot[] = [];

  for (const s of sorted) {
    const h = slotHour(s);
    if (prefs.tier1 !== null && h === prefs.tier1) {
      t1.push(s);
    } else if (
      prefs.tier2Start !== null &&
      prefs.tier2End !== null &&
      h >= prefs.tier2Start &&
      h <= prefs.tier2End
    ) {
      t2.push(s);
    } else {
      rest.push(s);
    }
  }

  const nightRest = rest.filter((s) => NIGHT_HOURS.includes(slotHour(s)));
  nightRest.sort((a, b) => {
    const pa = NIGHT_HOURS.indexOf(slotHour(a));
    const pb = NIGHT_HOURS.indexOf(slotHour(b));
    if (pa !== pb) return pa - pb;
    return new Date(a.schedule_from).getTime() - new Date(b.schedule_from).getTime();
  });
  const otherRest = rest.filter((s) => !NIGHT_HOURS.includes(slotHour(s)));

  const combined = [...t1, ...t2, ...nightRest, ...otherRest];
  const bestTier: 1 | 2 | 3 = t1.length > 0 ? 1 : t2.length > 0 ? 2 : 3;
  return { candidates: combined, tier: bestTier };
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
  bookingBudget: BookingPostBudget;
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
  bookingBudget,
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
    await bookingBudget.take();

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
      throwBookingRateLimited(response, "");
    }

    if (!response.ok) {
      let rawBody = "";
      try { rawBody = await response.text(); } catch {}
      logToFile(`Booking HTTP ${response.status} ${response.statusText} | body: ${rawBody.slice(0, 500)}`);
      return false;
    }

    const data = await response.json();

    if (data.success === false) {
      const errMsg =
        data.error?.[0]?.message ||
        data.errors?.[0]?.message ||
        data.message ||
        "Unknown error";
      process.stdout.write("\n");
      print(c.red, `Booking rejected: ${errMsg}`);
      if (errMsg === errorMessages.incorrectDeclarationNumber) {
        throw new Error(errorMessages.incorrectDeclarationNumber);
      }
      if (isBookingRateLimitMessage(errMsg)) {
        throwBookingRateLimited(response, errMsg);
      }
      return false;
    }

    return true;
  } catch (error) {
    if (isAbortError(error)) return false;
    const msg = (error as Error).message;
    if (msg === errorMessages.tooManyRequests) throw error;
    if (msg === errorMessages.bookingRateLimited) throw error;
    if (msg === errorMessages.incorrectDeclarationNumber) throw error;
    logToFile(`Booking exception: ${msg}`);
    return false;
  }
}

type BookRaceResult = {
  booked?: ScheduleSlot;
  badDeclaration: boolean;
  rateLimitedAll: boolean;
  cooldownMs: number;
};

function raceBookAllTokens(
  candidates: ScheduleSlot[],
  driver: DriverEntry,
  tag: string,
): Promise<BookRaceResult> {
  return raceBookBatches(candidates, 0, driver, tag);
}

async function raceBookBatches(
  candidates: ScheduleSlot[],
  startOffset: number,
  driver: DriverEntry,
  tag: string,
): Promise<BookRaceResult> {
  const tokens = driver.args.bookingTokens;

  for (let offset = startOffset; offset < candidates.length; offset += PARALLEL_BOOK_COUNT) {
    const slotBatch = candidates.slice(offset, offset + PARALLEL_BOOK_COUNT);
    const batchNum = Math.floor(offset / PARALLEL_BOOK_COUNT) + 1;
    print(c.yellow, `${tag}Booking batch ${batchNum} - ${slotBatch.length} slot(s) x ${tokens.length} token(s)...`);

    const globalAbort = new AbortController();
    let bookedSlot: ScheduleSlot | undefined;
    let badDeclaration = false;
    let rateLimitedCount = 0;
    let maxCooldownMs = 0;
    const totalPairs = tokens.length * slotBatch.length;

    const tasks: Promise<void>[] = [];
    for (const token of tokens) {
      const budget = bookingBudgetForToken(token);
      for (const slot of slotBatch) {
        tasks.push(
          (async () => {
            if (globalAbort.signal.aborted) return;
            try {
              const ok = await bookAppointment({
                token,
                licenseNo: driver.args.licenseNo,
                plateCountry: driver.args.plateCountry,
                residentCountry: driver.args.residentCountry,
                vehicleSequenceNumber: driver.args.vehicleSequenceNumber,
                chassisNo: driver.args.chassisNo,
                declaration_number: driver.args.declaration_number,
                port_code: slot.port_code,
                zone_schedule_id: slot.zone_schedule_id,
                bookingBudget: budget,
                signal: globalAbort.signal,
              });
              if (ok && !bookedSlot) {
                bookedSlot = slot;
                globalAbort.abort();
              }
            } catch (e) {
              if (isAbortError(e)) return;
              const msg = (e as Error).message;
              if (msg === errorMessages.incorrectDeclarationNumber) {
                badDeclaration = true;
                globalAbort.abort();
              } else if (
                msg === errorMessages.bookingRateLimited ||
                msg === errorMessages.tooManyRequests
              ) {
                rateLimitedCount++;
                const cd = getBookingCooldownMs(e);
                if (cd > maxCooldownMs) maxCooldownMs = cd;
              }
            }
          })(),
        );
      }
    }

    await Promise.allSettled(tasks);

    if (bookedSlot) {
      return { booked: bookedSlot, badDeclaration: false, rateLimitedAll: false, cooldownMs: 0 };
    }
    if (badDeclaration) {
      return { badDeclaration: true, rateLimitedAll: false, cooldownMs: 0 };
    }
    if (rateLimitedCount >= totalPairs) {
      return { badDeclaration: false, rateLimitedAll: true, cooldownMs: maxCooldownMs || BOOKING_COOLDOWN_FALLBACK_MS };
    }

    print(c.dim, `${tag}Batch ${batchNum} failed, trying next slots...`);
  }

  return { badDeclaration: false, rateLimitedAll: false, cooldownMs: 0 };
}

function printBookingResult(
  success: boolean,
  args: DriverArgs,
  slot?: ScheduleSlot,
): void {
  const sep = "=".repeat(40);
  console.log(sep);
  print(
    success ? c.green : c.red,
    `${possessiveLabel(args.driverName)} appointment = ${success}`,
  );
  console.log(`License number:        ${args.licenseNo}`);
  console.log(`Vehicle serial number: ${args.vehicleSequenceNumber}`);
  if (success && slot) {
    console.log(`Slot (Riyadh):         ${formatScheduleFromRiyadh(slot.schedule_from)}`);
    console.log(`Zone schedule ID:      ${slot.zone_schedule_id}`);
  }
  console.log(sep + "\n");
}

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: "tier 1 (exact hour)",
  2: "tier 2 (window)",
  3: "tier 3 (fallback)",
};

async function runOrchestrator(
  searchToken: string,
  port_code: string,
  drivers: DriverEntry[],
): Promise<void> {
  const multiMode = drivers.length > 1;
  const active = new Map<number, DriverEntry>();
  drivers.forEach((d, i) => active.set(i, d));

  const cooldownUntil = new Map<number, number>();

  let attempt = 0;
  let rateLimitCount = 0;
  let noSlotCount = 0;
  const startTime = Date.now();

  while (attempt < MAX_TRIES && active.size > 0) {
    attempt++;

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    writeStatus(
      `Searching... attempt ${attempt} | ${elapsed}s | rate-limited ${rateLimitCount}x | no slots ${noSlotCount}x | ${active.size} driver(s)`,
    );

    let allSlots: ScheduleSlot[] = [];
    try {
      const schedule = await getSchedule({ port_code, token: searchToken });
      allSlots = (schedule as ScheduleSuccessResponse).schedules ?? [];
    } catch (error) {
      const msg = (error as Error).message;
      if (msg === errorMessages.tooManyRequests) {
        rateLimitCount++;
        await sleepWithJitter(getScheduleBackoffMs(error), JITTER_RATE_LIMIT_MS);
        continue;
      }
      noSlotCount++;
      await sleepWithJitter(NO_SLOTS_DELAY_MS, JITTER_NO_SLOTS_MS);
      continue;
    }

    if (allSlots.length === 0) {
      noSlotCount++;
      await sleepWithJitter(NO_SLOTS_DELAY_MS, JITTER_NO_SLOTS_MS);
      continue;
    }

    clearStatus();

    const now = Date.now();
    const jobs: { idx: number; driver: DriverEntry; candidates: ScheduleSlot[]; tier: 1 | 2 | 3 }[] = [];

    for (const [idx, driver] of active) {
      const cd = cooldownUntil.get(idx) ?? 0;
      if (now < cd) {
        const left = Math.ceil((cd - now) / 1000);
        const tag = multiMode ? `[${driver.label}] ` : "";
        print(c.dim, `${tag}Booking cooldown ${left}s remaining, skipping...`);
        continue;
      }
      const { candidates, tier } = applyTierFilter(allSlots, driver.args.hourPrefs);
      if (candidates.length > 0) {
        jobs.push({ idx, driver, candidates, tier });
      }
    }

    if (jobs.length === 0) {
      writeStatus(
        `${allSlots.length} slot(s) open, none match prefs or all on cooldown | attempt ${attempt}`,
      );
      await sleepWithJitter(NO_SLOTS_DELAY_MS, JITTER_NO_SLOTS_MS);
      continue;
    }

    for (const job of jobs) {
      const head = job.candidates[0];
      const tag = multiMode ? `[${job.driver.label}] ` : "";
      print(
        c.yellow,
        `${tag}Slots found (${job.candidates.length}) via ${TIER_LABEL[job.tier]}: best ${head.schedule_from} (${slotHour(head)}:00), avail ${head.available_slot}`,
      );
    }

    const results = await Promise.allSettled(
      jobs.map((job) => {
        const tag = multiMode ? `[${job.driver.label}] ` : "";
        return raceBookAllTokens(job.candidates, job.driver, tag);
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const job = jobs[i]!;
      const tag = multiMode ? `[${job.driver.label}] ` : "";

      if (r.status === "fulfilled") {
        const v = r.value;
        if (v.booked) {
          console.log("");
          printBookingResult(true, job.driver.args, v.booked);
          active.delete(job.idx);
          cooldownUntil.delete(job.idx);
        } else if (v.badDeclaration) {
          print(c.red, `${tag}Declaration number invalid. Removing driver.`);
          printBookingResult(false, job.driver.args);
          active.delete(job.idx);
          cooldownUntil.delete(job.idx);
        } else if (v.rateLimitedAll) {
          rateLimitCount++;
          print(c.yellow, `${tag}All booking tokens rate limited - ${Math.ceil(v.cooldownMs / 1000)}s cooldown`);
          cooldownUntil.set(job.idx, Date.now() + v.cooldownMs);
        } else {
          print(c.dim, `${tag}Booking failed (slots may have been taken).`);
        }
      } else {
        print(c.red, `${tag}Unexpected booking error: ${r.reason}`);
      }
    }

    if (active.size === 0) break;

    await sleepWithJitter(POLL_INTERVAL_MS, JITTER_POLL_MS);
  }

  for (const [_, driver] of active) {
    const tag = multiMode ? `[${driver.label}] ` : "";
    print(c.red, `${tag}Max attempts (${MAX_TRIES}) reached without a successful booking.`);
    printBookingResult(false, driver.args);
  }
}

void (async () => {
  try {
    logToFile("--- session start v" + VERSION + " ---");
    print(c.dim, `Port appointment finder v${VERSION}`);

    let searchToken: string;
    let port_code: string;
    let drivers: DriverEntry[];

    if (process.env["BOT_UI_MODE"] === "1" && process.env["BOT_CONFIG"]) {
      const cfg = JSON.parse(process.env["BOT_CONFIG"]);
      searchToken = cfg.searchToken;
      port_code = cfg.port_code;
      drivers = (cfg.drivers as DriverArgs[]).map((d) => ({ label: d.driverName, args: d }));
    } else {
      const setup = await collectSetup();
      searchToken = setup.searchToken;
      port_code = setup.port_code;
      drivers = setup.drivers;
    }

    logToFile(`Setup: port=${port_code} drivers=${drivers.length}`);
    await runOrchestrator(searchToken, port_code, drivers);
  } catch (error) {
    clearStatus();
    print(c.red, `Fatal error: ${(error as Error).message}`);
    process.exit(1);
  }
})();
