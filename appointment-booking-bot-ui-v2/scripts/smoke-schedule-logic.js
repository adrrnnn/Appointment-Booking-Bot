/**
 * Pure-node smoke: scheduled task state transitions (mirrors useScheduleTimer rules).
 * Run: node scripts/smoke-schedule-logic.js
 */

const TOKEN_PROMPT_LEAD_MS = 40 * 60 * 1000;
const SESSION_SCHEDULE_PRESET_ID = "__session__";

function resolvePreset(task, presets) {
  if (task.runMode === "session" || task.presetId === SESSION_SCHEDULE_PRESET_ID) {
    return { id: SESSION_SCHEDULE_PRESET_ID, name: "Full session", driver: {}, savedAt: 0 };
  }
  return presets.find((p) => p.id === task.presetId);
}

function tickOnce(scheduledTasks, presets, now) {
  let next = [...scheduledTasks];
  let prompts = 0;
  let starts = 0;

  for (let i = 0; i < next.length; i++) {
    const task = next[i];
    const preset = resolvePreset(task, presets);
    if (!preset) continue;
    const timeUntil = task.scheduledFor - now;

    if (task.status === "pending" && timeUntil <= TOKEN_PROMPT_LEAD_MS) {
      next[i] = { ...task, status: "awaiting_tokens" };
      prompts++;
    }

    if (task.status === "tokens_ready" && timeUntil <= 0) {
      next[i] = { ...task, status: "running" };
      starts++;
    }

    if (task.status === "awaiting_tokens" && timeUntil <= -60_000) {
      next[i] = { ...task, status: "failed" };
    }
  }

  return { next, prompts, starts };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const preset = { id: "p1", name: "Test", driver: {}, savedAt: 0 };
const presets = [preset];

// 1) Run in 5 minutes: must prompt (old bug: never prompted)
const soon = Date.now() + 5 * 60 * 1000;
let tasks = [
  { id: "a", presetId: "p1", presetName: "T", driverIdx: 0, scheduledFor: soon, status: "pending" },
];
let r = tickOnce(tasks, presets, Date.now());
assert(r.prompts === 1 && r.next[0].status === "awaiting_tokens", "Soon run should enter awaiting_tokens");

// 2) tokens_ready at due time starts
tasks = [
  {
    id: "b",
    presetId: "p1",
    presetName: "T",
    driverIdx: 0,
    scheduledFor: Date.now() - 1000,
    status: "tokens_ready",
    freshSearchToken: "s",
    freshBookingTokens: ["b"],
  },
];
r = tickOnce(tasks, presets, Date.now());
assert(r.starts === 1 && r.next[0].status === "running", "tokens_ready past due should become running");

// 3) Pending way past due still gets prompt path first tick
const past = Date.now() - 120_000;
tasks = [{ id: "c", presetId: "p1", presetName: "T", driverIdx: 0, scheduledFor: past, status: "pending" }];
r = tickOnce(tasks, presets, Date.now());
assert(r.prompts === 1 && r.next[0].status === "awaiting_tokens", "Overdue pending should enter awaiting_tokens");

// 4) Second tick: awaiting_tokens should NOT prompt again
tasks = r.next;
r = tickOnce(tasks, presets, Date.now());
assert(r.prompts === 0, "awaiting_tokens must not re-trigger token prompt every tick");

// 5) tokens_ready but run still in future: no start
const future = Date.now() + 60 * 60 * 1000;
tasks = [
  {
    id: "d",
    presetId: "p1",
    presetName: "T",
    driverIdx: 0,
    scheduledFor: future,
    status: "tokens_ready",
    freshSearchToken: "s",
    freshBookingTokens: ["b"],
  },
];
r = tickOnce(tasks, presets, Date.now());
assert(r.starts === 0 && r.next[0].status === "tokens_ready", "tokens_ready before due must not start");

// 6) awaiting_tokens >1min past due -> failed
const wayPast = Date.now() - 120_000;
tasks = [{ id: "e", presetId: "p1", presetName: "T", driverIdx: 0, scheduledFor: wayPast, status: "awaiting_tokens" }];
r = tickOnce(tasks, presets, Date.now());
assert(r.next[0].status === "failed", "awaiting_tokens long past due should fail");

// 7) Session task without preset row: still transitions
tasks = [
  {
    id: "sess",
    presetId: SESSION_SCHEDULE_PRESET_ID,
    presetName: "Full session",
    driverIdx: 0,
    scheduledFor: soon,
    status: "pending",
    runMode: "session",
  },
];
r = tickOnce(tasks, [], Date.now());
assert(r.prompts === 1 && r.next[0].status === "awaiting_tokens", "session pending should enter awaiting_tokens");

tasks = [
  {
    id: "sess2",
    presetId: SESSION_SCHEDULE_PRESET_ID,
    presetName: "Full session",
    driverIdx: 0,
    scheduledFor: Date.now() - 500,
    status: "tokens_ready",
    runMode: "session",
    freshSearchToken: "x",
    freshBookingTokens: [],
  },
];
r = tickOnce(tasks, [], Date.now());
assert(r.starts === 1 && r.next[0].status === "running", "session tokens_ready past due should run");

console.log("smoke-schedule-logic: OK");
