/**
 * End-to-end test for LuckyDraw. Requires a running server:
 *
 *   npm run build && npm run start      # production (port 3100)
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Or against the dev server:
 *
 *   npm run dev                         # port 3000
 *   npm run test:e2e
 *
 * Covers: page rendering, guest scope, auth (register/login/logout/sessions),
 * roster CRUD, draw lifecycle (create -> lock -> select -> complete), winner
 * elimination, completed-draw extension (draw again without navigating), SSE
 * stream events, public verification payload, and ownership and authorization
 * rules.
 *
 * Creates its own throwaway data and cleans it up. Exit code 0 = all passed.
 */
const BASE = process.env.BASE_URL || "http://localhost:3100";
const STAMP = Date.now().toString(36).toUpperCase();
const GUEST_KEY = `guest-${STAMP}`.slice(0, 32);
const EMAIL = `e2e-${STAMP}@example.com`;
const PASSWORD = "s3curePass!";

let cookie = null;
let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    failures.push(`${name} ${extra}`);
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function req(path, { method = "GET", body, headers = {}, useCookie = true, guest } = {}) {
  const h = { ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (useCookie && cookie) h.cookie = cookie;
  if (guest) h["x-guest-key"] = guest;
  const res = await fetch(BASE + path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: h,
    redirect: "manual",
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* html or non-json */
  }
  return { status: res.status, data, text, headers: res.headers };
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Read SSE frames until `needle` appears or the deadline passes. */
async function readUntil(reader, needle, ms = 8000) {
  const decoder = new TextDecoder();
  const deadline = Date.now() + ms;
  let buf = "";
  while (Date.now() < deadline) {
    const wait = Math.max(1, deadline - Date.now());
    const res = await Promise.race([
      reader.read(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), wait)),
    ]).catch(() => null);
    if (!res) break;
    buf += decoder.decode(res.value || new Uint8Array(), { stream: true });
    if (buf.includes(needle)) return buf;
    if (res.done) break;
  }
  return buf;
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  // ---------- pages ----------
  section("Pages render");
  for (const [path, marker] of [
    ["/", "LuckyDraw"],
    // /auth wraps its content in the documented useSearchParams() Suspense
    // boundary, so SSR ships the fallback (empty shell) and hydrates after.
    ["/auth", "min-h-screen"],
    ["/dashboard", ""],
    ["/draw/new", ""],
    ["/verify", "Verify"],
  ]) {
    const r = await req(path, { useCookie: false });
    check(`GET ${path} -> 200`, r.status === 200, `got ${r.status}`);
    if (marker) check(`GET ${path} contains "${marker}"`, r.text.includes(marker));
  }
  const nf = await req("/draw/LD-NOPE12", { useCookie: false });
  check("GET unknown draw -> 404", nf.status === 404, `got ${nf.status}`);

  // ---------- guest scope ----------
  section("Guest scope + auth guards");
  const me0 = await req("/api/auth/me", { useCookie: false });
  check("GET /api/auth/me unauthenticated -> 200", me0.status === 200, `got ${me0.status}`);
  check("  user is null", me0.data?.user === null, JSON.stringify(me0.data));

  const noScope = await req("/api/draws", { method: "POST", body: { name: "x" } });
  check("POST /api/draws without scope -> 401", noScope.status === 401, `got ${noScope.status}`);

  const gNoScope = await req("/api/draws", {
    method: "POST",
    body: { name: "x", participants: [{ name: "a" }] },
    guest: GUEST_KEY,
  });
  check("guest key accepted (create draw) -> 201", gNoScope.status === 201, `got ${gNoScope.status}`);
  const throwawayId = gNoScope.data?.drawId;

  // ---------- roster CRUD (guest) ----------
  section("Roster CRUD");
  const roster = await req("/api/rosters", {
    method: "POST",
    guest: GUEST_KEY,
    body: { title: `E2E Roster ${STAMP}`, names: ["Amara", "Diego", "Mei-Ling"] },
  });
  check("POST /api/rosters -> 201", roster.status === 201, `got ${roster.status}`);
  const rosterId = roster.data?.roster?.id;
  check("  roster has 3 names", roster.data?.roster?.names?.length === 3, JSON.stringify(roster.data));

  const rosterList = await req("/api/rosters", { guest: GUEST_KEY });
  check("GET /api/rosters lists it", rosterList.data?.rosters?.some((r) => r.id === rosterId));

  const rosterPatch = await req(`/api/rosters/${rosterId}`, {
    method: "PATCH",
    guest: GUEST_KEY,
    body: { names: ["Amara", "Diego", "Mei-Ling", "Kofi"] },
  });
  check("PATCH roster -> 4 names", rosterPatch.data?.roster?.names?.length === 4, JSON.stringify(rosterPatch.data));

  const otherGuest = await req(`/api/rosters/${rosterId}`, {
    method: "DELETE",
    guest: `intruder-${STAMP}`.slice(0, 32),
  });
  check("other guest cannot delete roster -> 403", otherGuest.status === 403, `got ${otherGuest.status}`);

  // ---------- draw lifecycle (guest) ----------
  section("Draw lifecycle: create -> lock -> select -> complete");
  const created = await req("/api/draws", {
    method: "POST",
    guest: GUEST_KEY,
    body: {
      name: `E2E Giveaway ${STAMP}`,
      eventName: "QA Run",
      prize: "Voucher",
      winnerCountTarget: 2,
      settings: { animationStyle: "wheel", privacy: "public", removeWinnersOnSelect: true },
      participants: [
        { name: "Amara Okafor", entryCount: 3 },
        { name: "Diego Ramirez", entryCount: 1 },
        { name: "Mei-Ling Chen", entryCount: 2 },
        { name: "Kofi Mensah", entryCount: 1 },
        { name: "Sara Kim", entryCount: 1 },
      ],
    },
  });
  check("POST /api/draws -> 201", created.status === 201, `got ${created.status} ${JSON.stringify(created.data)}`);
  const drawId = created.data?.drawId;
  expect(drawId, "no drawId returned");

  const badTarget = await req("/api/draws", {
    method: "POST",
    guest: GUEST_KEY,
    body: { name: "bad", winnerCountTarget: 99, participants: [{ name: "a" }] },
  });
  check("winner target > participants rejected -> 400", badTarget.status === 400, `got ${badTarget.status}`);

  const earlySelect = await req(`/api/draws/${drawId}/select`, { method: "POST", guest: GUEST_KEY });
  check("select before lock -> 4xx", earlySelect.status >= 400 && earlySelect.status < 500, `got ${earlySelect.status}`);

  // SSE stream should announce events
  const ac = new AbortController();
  const streamRes = await fetch(`${BASE}/api/draws/${drawId}/stream`, {
    headers: { "x-guest-key": GUEST_KEY, accept: "text/event-stream" },
    signal: ac.signal,
  });
  check("SSE stream -> 200", streamRes.status === 200, `got ${streamRes.status}`);
  check("SSE content-type text/event-stream", (streamRes.headers.get("content-type") || "").includes("text/event-stream"));
  const reader = streamRes.body.getReader();
  const firstFrame = await readUntil(reader, "connected");
  check("SSE first frame received", firstFrame.includes("connected"), String(firstFrame).slice(0, 80));

  const updatedFrame = readUntil(reader, "draw.updated");
  const updatedDraw = await req(`/api/draws/${drawId}`, {
    method: "PATCH",
    guest: GUEST_KEY,
    body: { name: "Updated live draw" },
  });
  check("PATCH draw -> 200", updatedDraw.status === 200, `got ${updatedDraw.status}`);
  check(
    "SSE pushed draw.updated",
    (await updatedFrame).includes("draw.updated"),
  );

  const locked = await req(`/api/draws/${drawId}/lock`, { method: "POST", guest: GUEST_KEY });
  check("POST lock -> IN_PROGRESS", locked.data?.status === "IN_PROGRESS", JSON.stringify(locked.data?.status));
  check("  lockedAt set", Boolean(locked.data?.lockedAt));
  check("  lock response includes participants", Array.isArray(locked.data?.participants), JSON.stringify(Object.keys(locked.data ?? {})));

  const lockedAgain = await req(`/api/draws/${drawId}/lock`, { method: "POST", guest: GUEST_KEY });
  check("second lock is idempotent -> IN_PROGRESS", lockedAgain.data?.status === "IN_PROGRESS");

  const patchLocked = await req(`/api/draws/${drawId}`, {
    method: "PATCH",
    guest: GUEST_KEY,
    body: { winnerCountTarget: 5 },
  });
  check("winner target change after lock -> 400", patchLocked.status === 400, `got ${patchLocked.status}`);

  // two selections -> completion
  const sel1 = await req(`/api/draws/${drawId}/select`, { method: "POST", guest: GUEST_KEY });
  check("select #1 -> 200", sel1.status === 200, `got ${sel1.status} ${JSON.stringify(sel1.data)}`);
  check("  one winner recorded", sel1.data?.winners?.length === 1, JSON.stringify(sel1.data?.winners?.length));
  check("  winner has entropy fingerprint", Boolean(sel1.data?.winners?.[0]?.entropyFingerprint));
  const winner1 = sel1.data?.winners?.[0]?.name;
  const activeAfter1 = sel1.data?.participants?.filter((p) => p.status === "ACTIVE").length;
  check("  elimination removed winner from pool", activeAfter1 === 4, `active=${activeAfter1}`);

  // read frames until the selection event arrives (earlier frames may still be
  // buffered, e.g. the draw.locked event published during the lock step)
  const framePromise = readUntil(reader, "participant.selected");

  const sel2 = await req(`/api/draws/${drawId}/select`, { method: "POST", guest: GUEST_KEY });
  check("select #2 -> 200", sel2.status === 200, `got ${sel2.status}`);
  check("  draw now COMPLETED", sel2.data?.status === "COMPLETED", JSON.stringify(sel2.data?.status));
  check("  winnersSelectedCount == target", sel2.data?.winnersSelectedCount === 2);
  const winnerNames = (sel2.data?.winners || []).map((w) => w.name);
  check("  both winners are unique", new Set(winnerNames).size === winnerNames.length, JSON.stringify(winnerNames));
  check("  winner #1 was in the pool", winnerNames.includes(winner1), JSON.stringify(winnerNames));

  const secondFrame = await framePromise;
  check("SSE pushed an event during selection", String(secondFrame).includes("participant.selected"), String(secondFrame).slice(0, 100));
  ac.abort();

  const sel3 = await req(`/api/draws/${drawId}/select`, { method: "POST", guest: GUEST_KEY });
  check("select when complete -> 409", sel3.status === 409, `got ${sel3.status}`);

  // ---------- verification ----------
  section("Verification + exports");
  const pub = await req(`/api/public/draws/${drawId}`, { useCookie: false });
  check("GET /api/public/draws/[id] -> 200", pub.status === 200, `got ${pub.status}`);
  check("  payload has seedCommitment", Boolean(pub.data?.verification?.seedCommitment));
  check("  payload lists 2 winners", pub.data?.winners?.length === 2, JSON.stringify(pub.data?.winners?.length));
  check("  payload records randomness source", typeof pub.data?.verification?.randomness === "string");
  check("  payload lists all participants", pub.data?.participants?.length === 5);

  const resultsPage = await req(`/draw/${drawId}`, { useCookie: false });
  check("GET /draw/[id] results page -> 200", resultsPage.status === 200, `got ${resultsPage.status}`);
  check("  results page shows a winner", resultsPage.text.includes(winnerNames[0] || "___"));

  const presentPage = await req(`/present/${drawId}`, { useCookie: false });
  check("GET /present/[id] -> 200", presentPage.status === 200, `got ${presentPage.status}`);

  // ---------- completed-draw extension ----------
  section("Extend a completed draw (keep spinning in place)");
  const ext = await req(`/api/draws/${drawId}`, {
    method: "PATCH",
    guest: GUEST_KEY,
    body: { winnerCountTarget: 3 },
  });
  check("PATCH raise target on completed draw -> 200", ext.status === 200, `got ${ext.status} ${JSON.stringify(ext.data)}`);
  check("  draw re-opened to IN_PROGRESS", ext.data?.status === "IN_PROGRESS", JSON.stringify(ext.data?.status));
  check("  PATCH response includes participants", Array.isArray(ext.data?.participants), JSON.stringify(Object.keys(ext.data ?? {})));

  const extLower = await req(`/api/draws/${drawId}`, {
    method: "PATCH",
    guest: GUEST_KEY,
    body: { winnerCountTarget: 2 },
  });
  check("PATCH lower target on locked draw -> 400", extLower.status === 400, `got ${extLower.status}`);

  const sel4 = await req(`/api/draws/${drawId}/select`, { method: "POST", guest: GUEST_KEY });
  check("select after extension -> 200", sel4.status === 200, `got ${sel4.status} ${JSON.stringify(sel4.data)}`);
  check("  draw completed again", sel4.data?.status === "COMPLETED", JSON.stringify(sel4.data?.status));
  check("  three winners recorded", sel4.data?.winners?.length === 3, JSON.stringify(sel4.data?.winners?.length));
  const thirdWinner = sel4.data?.winners?.[2]?.name;
  check("  extended winner is not a repeat", Boolean(thirdWinner) && !winnerNames.includes(thirdWinner), JSON.stringify(thirdWinner));
  const activeFinal = sel4.data?.participants?.filter((p) => p.status === "ACTIVE").length;
  check("  all selected winners eliminated from pool", activeFinal === 2, `active=${activeFinal}`);

  // ---------- authorization ----------
  section("Authorization");
  const register = await req("/api/auth/register", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD, displayName: "E2E Tester" },
  });
  check("POST /api/auth/register -> 201", register.status === 201, `got ${register.status} ${JSON.stringify(register.data)}`);
  const me1 = await req("/api/auth/me");
  // the API lowercases emails on register
  check("session cookie works", me1.data?.user?.email === EMAIL.toLowerCase(), JSON.stringify(me1.data));

  const dupe = await req("/api/auth/register", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  check("duplicate register -> 409", dupe.status === 409, `got ${dupe.status}`);

  const guestDrawAsUser = await req(`/api/draws/${drawId}`, { method: "DELETE" });
  check("user cannot delete guest draw -> 403", guestDrawAsUser.status === 403, `got ${guestDrawAsUser.status}`);

  // user-owned draw
  const userDraw = await req("/api/draws", {
    method: "POST",
    body: {
      name: `E2E User Draw ${STAMP}`,
      winnerCountTarget: 1,
      participants: [{ name: "Ada" }, { name: "Linus" }],
    },
  });
  check("user creates draw -> 201", userDraw.status === 201, JSON.stringify(userDraw.data));
  const userDrawId = userDraw.data?.drawId;
  await req(`/api/draws/${userDrawId}/lock`, { method: "POST" });
  const userSel = await req(`/api/draws/${userDrawId}/select`, { method: "POST" });
  check("user draw selection works", userSel.status === 200, `got ${userSel.status}`);
  check("  completed", userSel.data?.status === "COMPLETED");

  const logout = await req("/api/auth/logout", { method: "POST" });
  check("POST logout -> 200", logout.status === 200, `got ${logout.status}`);
  cookie = null;
  const me2 = await req("/api/auth/me");
  check("session cleared after logout", me2.data?.user === null, JSON.stringify(me2.data));

  const wrongPass = await req("/api/auth/login", {
    method: "POST",
    useCookie: false,
    body: { email: EMAIL, password: "wrong-password" },
  });
  check("login with wrong password rejected", wrongPass.status >= 400 && wrongPass.status < 500, `got ${wrongPass.status}`);

  const rightPass = await req("/api/auth/login", {
    method: "POST",
    useCookie: false,
    body: { email: EMAIL, password: PASSWORD },
  });
  check("login with correct password -> 200", rightPass.status === 200, `got ${rightPass.status} ${JSON.stringify(rightPass.data)}`);

  // unauthenticated write guard on rosters
  cookie = null;
  const guard = await req("/api/rosters", { method: "POST", body: { title: "x", names: ["y"] } });
  check("roster create without scope -> 401", guard.status === 401, `got ${guard.status}`);

  // ---------- cleanup ----------
  section("Cleanup");
  await req("/api/auth/login", {
    method: "POST",
    useCookie: false,
    body: { email: EMAIL, password: PASSWORD },
  });
  const delUserDraw = await req(`/api/draws/${userDrawId}`, { method: "DELETE" });
  check("delete user draw -> 200", delUserDraw.status === 200, `got ${delUserDraw.status}`);
  if (rosterId) {
    // roster belongs to the guest scope, not the registered user
    const delRoster = await fetch(`${BASE}/api/rosters/${rosterId}`, {
      method: "DELETE",
      headers: { "x-guest-key": GUEST_KEY },
    });
    check("delete roster -> 200", delRoster.status === 200, `got ${delRoster.status}`);
  }
  await req("/api/auth/logout", { method: "POST" });
  cookie = null;

  // Remove the throwaway account directly from the database — there is no
  // HTTP API for deleting an account. Warns instead of failing when the
  // database is not reachable from the test runner.
  try {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const removed = await db.user.deleteMany({
      where: { email: EMAIL.toLowerCase() },
    });
    await db.$disconnect();
    check("test account removed from database", removed.count === 1, `count=${removed.count}`);
  } catch (err) {
    console.log(`  warn could not remove test account: ${err.message}`);
  }

  const delGuestDraw = await fetch(`${BASE}/api/draws/${drawId}`, {
    method: "DELETE",
    headers: { "x-guest-key": GUEST_KEY },
  });
  check("delete guest draw -> 200", delGuestDraw.status === 200, `got ${delGuestDraw.status}`);
  if (throwawayId) {
    await fetch(`${BASE}/api/draws/${throwawayId}`, {
      method: "DELETE",
      headers: { "x-guest-key": GUEST_KEY },
    });
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("Failures:\n - " + failures.join("\n - "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(2);
});
