// node scripts/smoke-scheduling-area-logic.js
// SchedulingArea slot counting and full-session task shape (see SchedulingArea.tsx).

const SESSION_SCHEDULE_PRESET_ID = "__session__";

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function buildSessionSlots(n, prev) {
  const next = prev.slice(0, n);
  while (next.length < n) next.push("");
  return next;
}

function countLoadApplications(slotsForUi, presets, nDrivers) {
  const presetById = new Map(presets.map((p) => [p.id, p]));
  let applied = 0;
  for (let i = 0; i < nDrivers; i++) {
    const pid = slotsForUi[i];
    if (!pid) continue;
    if (presetById.has(pid)) applied++;
  }
  return applied;
}

function shouldOpenForkAfterLoad(slotsForUi, presets, nDrivers) {
  return countLoadApplications(slotsForUi, presets, nDrivers) > 0;
}

function createFullSessionTask(localIso, taskId) {
  if (!localIso) return null;
  return {
    id: taskId,
    presetId: SESSION_SCHEDULE_PRESET_ID,
    presetName: "Full session",
    driverIdx: 0,
    scheduledFor: new Date(localIso).getTime(),
    status: "pending",
    runMode: "session",
  };
}

function createLegacySingleTask(presetId, presetName, driverIdx, localIso, taskId) {
  return {
    id: taskId,
    presetId,
    presetName,
    driverIdx,
    scheduledFor: new Date(localIso).getTime(),
    status: "pending",
    runMode: "single",
  };
}

function validateFullSessionTask(task) {
  assert(task && typeof task === "object", "task object");
  assert(typeof task.id === "string" && task.id.length > 0, "id");
  assert(task.presetId === SESSION_SCHEDULE_PRESET_ID, "presetId __session__");
  assert(task.presetName === "Full session", "presetName");
  assert(task.driverIdx === 0, "driverIdx");
  assert(typeof task.scheduledFor === "number" && Number.isFinite(task.scheduledFor), "scheduledFor");
  assert(task.status === "pending", "status pending");
  assert(task.runMode === "session", "runMode session");
}

function runOnce(label) {
  const presets = [
    { id: "p1", name: "Preset A" },
    { id: "p2", name: "Preset B" },
  ];

  assert(
    JSON.stringify(buildSessionSlots(3, ["x", "y", "z", "extra"])) === JSON.stringify(["x", "y", "z"]),
    `${label}: trim slots to nDrivers`,
  );
  const padded = buildSessionSlots(4, []);
  assert(padded.length === 4 && padded.every((s) => s === ""), `${label}: pad empties`);

  assert(countLoadApplications(["", "", ""], presets, 3) === 0, `${label}: all skip => 0 applied`);
  assert(shouldOpenForkAfterLoad(["", "", ""], presets, 3) === false, `${label}: no fork when none applied`);

  assert(countLoadApplications(["p1", "", ""], presets, 3) === 1, `${label}: one preset applied`);
  assert(shouldOpenForkAfterLoad(["p1", "", ""], presets, 3) === true, `${label}: fork when applied`);

  assert(countLoadApplications(["p1", "p2", "ghost"], presets, 3) === 2, `${label}: unknown preset id ignored`);
  assert(
    countLoadApplications(["p2", "p1", "p2"], presets, 3) === 3,
    `${label}: multiple slots count`,
  );

  assert(SESSION_SCHEDULE_PRESET_ID === "__session__", `${label}: SESSION_SCHEDULE_PRESET_ID constant`);

  const iso = "2026-06-15T14:30";
  const full = createFullSessionTask(iso, "550e8400-e29b-41d4-a716-446655440000");
  validateFullSessionTask(full);
  assert(full.scheduledFor === new Date(iso).getTime(), `${label}: datetime-local parse`);

  const leg = createLegacySingleTask("p1", "Preset A", 3, iso, "leg-1");
  assert(leg.runMode === "single", `${label}: legacy runMode`);
  assert(leg.driverIdx === 3, `${label}: legacy driverIdx`);
  assert(leg.presetId === "p1", `${label}: legacy presetId`);

  const existing = [{ id: "old", presetId: "p1", presetName: "x", driverIdx: 0, scheduledFor: 1, status: "done" }];
  const next = [...existing, createFullSessionTask(iso, "new-1")];
  assert(next.length === 2 && next[1].runMode === "session", `${label}: spread append`);
}

console.log("[smoke-scheduling-area-logic] pass 1…");
runOnce("pass1");
console.log("[smoke-scheduling-area-logic] pass 2 (repeat)…");
runOnce("pass2");

console.log("smoke-scheduling-area-logic: OK (2 runs)");
