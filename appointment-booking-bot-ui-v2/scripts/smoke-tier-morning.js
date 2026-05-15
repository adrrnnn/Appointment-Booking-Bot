/**
 * Mirrors applyTierFilter rest-ordering in bot/src/index.ts (morning vs night branches).
 * Uses __h for deterministic slot hours (ordering logic only; not Date parsing).
 * Run: node scripts/smoke-tier-morning.js
 */

const NIGHT_HOURS = [19, 20, 21, 22, 23];

function isMorningHour(h) {
  return h >= 0 && h <= 12;
}

function slotHour(slot) {
  if (typeof slot.__h === "number") return slot.__h;
  slot._parsedFromMs ??= new Date(slot.schedule_from).getTime();
  return new Date(slot._parsedFromMs).getHours();
}

function compareSlotsByStart(a, b) {
  a._parsedFromMs ??= new Date(a.schedule_from).getTime();
  b._parsedFromMs ??= new Date(b.schedule_from).getTime();
  return a._parsedFromMs - b._parsedFromMs;
}

function sortSlotsByStart(slots) {
  return [...slots].sort(compareSlotsByStart);
}

function orderRest(rest, prefs) {
  const noHourPrefs = prefs.tier1 === null && prefs.tier2Start === null;
  if (noHourPrefs) {
    const morningRest = rest.filter((s) => isMorningHour(slotHour(s)));
    morningRest.sort((a, b) => {
      const ha = slotHour(a);
      const hb = slotHour(b);
      if (ha !== hb) return ha - hb;
      return compareSlotsByStart(a, b);
    });
    const otherRest = rest.filter((s) => !isMorningHour(slotHour(s)));
    otherRest.sort(compareSlotsByStart);
    return [...morningRest, ...otherRest];
  }
  const nightRest = rest.filter((s) => NIGHT_HOURS.includes(slotHour(s)));
  nightRest.sort((a, b) => {
    const pa = NIGHT_HOURS.indexOf(slotHour(a));
    const pb = NIGHT_HOURS.indexOf(slotHour(b));
    if (pa !== pb) return pa - pb;
    return compareSlotsByStart(a, b);
  });
  const otherRest = rest.filter((s) => !NIGHT_HOURS.includes(slotHour(s)));
  return [...nightRest, ...otherRest];
}

function buildRest(sorted, prefs) {
  const t1 = [];
  const t2 = [];
  const rest = [];
  for (const s of sorted) {
    const h = slotHour(s);
    if (prefs.tier1 !== null && h === prefs.tier1) t1.push(s);
    else if (
      prefs.tier2Start !== null &&
      prefs.tier2End !== null &&
      h >= prefs.tier2Start &&
      h <= prefs.tier2End
    )
      t2.push(s);
    else rest.push(s);
  }
  return { t1, t2, rest };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const mk = (h, ord) => ({
  __h: h,
  zone_schedule_id: `z-${h}-${ord}`,
  port_code: "95",
  schedule_from: `2026-06-01T${String(h).padStart(2, "0")}:00:00.000Z`,
  schedule_to: `2026-06-01T${String(h).padStart(2, "0")}:00:00.000Z`,
  slot_status: "",
  scheduled_slot: 0,
  available_slot: 1,
});

const a = mk(3, 0);
const b = mk(8, 1);
const c = mk(19, 2);
const sorted = sortSlotsByStart([c, b, a]);

const prefsNone = { tier1: null, tier2Start: null, tier2End: null };
const r0 = buildRest(sorted, prefsNone);
assert(r0.t1.length === 0 && r0.t2.length === 0, "all in rest");
const o0 = orderRest(r0.rest, prefsNone);
assert(
  slotHour(o0[0]) === 3 && slotHour(o0[1]) === 8 && slotHour(o0[2]) === 19,
  `no prefs: want 3,8,19 got ${o0.map(slotHour)}`,
);

const prefsT2 = { tier1: null, tier2Start: 10, tier2End: 12 };
const r1 = buildRest(sorted, prefsT2);
assert(r1.rest.length === 3, "all three outside tier2");
const o1 = orderRest(r1.rest, prefsT2);
assert(
  slotHour(o1[0]) === 19 && slotHour(o1[1]) === 3 && slotHour(o1[2]) === 8,
  `with tier2: want 19,3,8 got ${o1.map(slotHour)}`,
);

console.log("smoke-tier-morning: OK");
