/**
 * One-off browser verification for LuckyDraw spin flow.
 * Drives headless Chrome via CDP (Node >= 22 global WebSocket).
 *
 * Verifies per spin:
 *  - stage reveal shows the TRUE winner (DB truth) — pre-fix it showed pool[0]
 *  - banner ("Winner #N") and "Winners so far" show the same name
 *  - previous winners are eliminated from the pool/stage
 *  - button stays usable: "Draw Winner" -> "Draw another winner" (extension)
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = "http://localhost:3000";
const PORT = 9333;
const GUEST = `cdetest-${Date.now().toString(36)}`.slice(0, 32);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const NAMES = ["Amara", "Diego", "Mei", "Kofi", "Sara", "Omar"];

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-guest-key": GUEST,
      ...(body ? {} : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, data };
}

async function createDraw(animationStyle) {
  const created = await api("/api/draws", {
    method: "POST",
    body: {
      name: `CDE ${animationStyle} ${Date.now().toString(36)}`,
      winnerCountTarget: 1,
      settings: { animationStyle, privacy: "public", removeWinnersOnSelect: true },
      participants: NAMES.map((name) => ({ name })),
    },
  });
  if (created.status !== 201) throw new Error("create failed: " + JSON.stringify(created));
  const id = created.data.drawId;
  const locked = await api(`/api/draws/${id}/lock`, { method: "POST" });
  if (locked.data?.status !== "IN_PROGRESS") throw new Error("lock failed");
  return id;
}

const truth = async (id) => {
  const r = await api(`/api/draws/${id}`);
  const winners = r.data.winners ?? [];
  const participants = r.data.participants ?? [];
  const active = participants.filter((p) => p.status === "ACTIVE");
  return { winners, participants, active, status: r.data.status, target: r.data.winnerCountTarget };
};

// Reveal candidates as the app builds them: pool order, ACTIVE + the winner
// being revealed (they were eliminated the moment they were picked).
const revealNames = (db, winner) =>
  db.participants
    .filter((p) => p.status === "ACTIVE" || p.id === winner?.participantId)
    .map((p) => p.name);

// ---------- CDP ----------
let nextId = 0;
const pending = new Map();
let ws;

function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}

async function waitFor(expression, desc, timeout = 20000, interval = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evalJs(expression)) return;
    await sleep(interval);
  }
  throw new Error(`timeout waiting for: ${desc}`);
}

const SNAP = `(() => {
  if (!document.body) return JSON.stringify({ stage: null, lis: [], banner: null, pool: null, buttons: [], struck: [] });
  const stage = document.querySelector('div[role="status"][class*="min-h-"]');
  const h2 = [...document.querySelectorAll("h2")].find(h => h.textContent.includes("Winners so far"));
  const lis = h2 ? [...h2.parentElement.parentElement.querySelectorAll("ul li")].map(li => li.innerText.replace(/\\s+/g, " ").trim()) : [];
  const wP = [...document.querySelectorAll("p")].find(p => /^Winner #\\d+$/.test(p.textContent.trim()));
  const banner = wP ? wP.parentElement.parentElement.innerText.replace(/\\s+/g, " ").trim() : null;
  const poolM = document.body.innerText.match(/(\\d+) Remaining in Pool/);
  const buttons = [...document.querySelectorAll("button")].map(b => ({
    t: b.textContent.replace(/\\s+/g, " ").trim(),
    d: b.disabled,
  }));
  const struck = [...document.querySelectorAll("li")].filter(li => li.className.includes("line-through")).map(li => li.innerText.replace(/\\s+/g, " ").trim());
  const wheelG = [...document.querySelectorAll('div[role="status"] svg g')].find(x => x.querySelector('path[d^="M120,120"]'));
  return JSON.stringify({
    stage: stage ? stage.innerText.replace(/\\s+/g, " ").trim() : null,
    lis, banner,
    pool: poolM ? Number(poolM[1]) : null,
    buttons, struck,
    wheelTransform: wheelG ? wheelG.getAttribute("transform") : null,
  });
})()`;

const snap = async () => JSON.parse(await evalJs(SNAP));

async function clickButton(label) {
  const expr = `(() => {
    const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes(${JSON.stringify(label)}));
    if (!b) return "missing";
    if (b.disabled) return "disabled";
    b.click();
    return "clicked";
  })()`;
  const r = await evalJs(expr);
  if (r !== "clicked") throw new Error(`click ${JSON.stringify(label)} -> ${r}`);
}

async function spin(id, buttonLabel, settleMs) {
  await waitFor(
    `(() => { const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes(${JSON.stringify(buttonLabel)})); return b && !b.disabled; })()`,
    `enabled button ${JSON.stringify(buttonLabel)}`,
  );
  await clickButton(buttonLabel);
  await sleep(settleMs);
  const ui = await snap();
  const db = await truth(id);
  return { ui, db };
}

async function main() {
  const cardId = await createDraw("card");
  const wheelId = await createDraw("wheel");
  console.log(`draws: card=${cardId} wheel=${wheelId} guest=${GUEST}`);

  const profile = mkdtempSync(join(tmpdir(), "ld-cdp-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate",
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    // wait for devtools endpoint
    let targets = null;
    for (let i = 0; i < 60; i += 1) {
      try {
        targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
        break;
      } catch {
        await sleep(250);
      }
    }
    if (!targets) throw new Error("chrome devtools not reachable");
    const page = targets.find((t) => t.type === "page");
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { localStorage.setItem("ld_guest_key", ${JSON.stringify(GUEST)}); } catch (e) {}`,
    });

    // ---------- card draw: 3 spins in place ----------
    console.log("\n=== card draw: spin, spin again, spin again ===");
    await send("Page.navigate", { url: `${BASE}/present/${cardId}` });
    await waitFor(
      `Boolean(document.body) && document.body.innerText.includes("Remaining in Pool")`,
      "present page ready",
    );

    let snap1 = await spin(cardId, "Draw Winner", 4500);
    check("spin1: stage shows the true winner", Boolean(snap1.db.winners[0]) && snap1.ui.stage.includes(snap1.db.winners[0].name), `stage=${JSON.stringify(snap1.ui.stage)} db=${snap1.db.winners[0]?.name}`);
    check("spin1: banner shows the true winner", Boolean(snap1.db.winners[0]) && (snap1.ui.banner ?? "").includes(snap1.db.winners[0].name), `banner=${JSON.stringify(snap1.ui.banner)}`);
    check("spin1: Winners so far shows the true winner", snap1.ui.lis[0]?.includes(snap1.db.winners[0]?.name ?? "___"), `list=${JSON.stringify(snap1.ui.lis)}`);
    check("spin1: stage does NOT show the first entrant", !snap1.ui.stage.includes(NAMES[0]), `stage=${JSON.stringify(snap1.ui.stage)}`);
    check("spin1: pool eliminated the winner (5 remain)", snap1.ui.pool === 5 && snap1.db.active.length === 5, `pool=${snap1.ui.pool} active=${snap1.db.active.length}`);
    check("spin1: winner struck through in pool snapshot", snap1.ui.struck.some((s) => s.includes(snap1.db.winners[0]?.name ?? "___")), JSON.stringify(snap1.ui.struck));
    check("spin1: button offers in-place re-draw", snap1.ui.buttons.some((b) => b.t.includes("Draw another winner") && !b.d), JSON.stringify(snap1.ui.buttons.map((b) => b.t)));
    check("spin1: draw is COMPLETED (target 1)", snap1.db.status === "COMPLETED" && snap1.db.target === 1, `${snap1.db.status}/${snap1.db.target}`);

    let snap2 = await spin(cardId, "Draw another winner", 4500);
    check("spin2: worked without navigating away", snap2.db.winners.length === 2, `winners=${snap2.db.winners.length}`);
    check("spin2: stage shows the new true winner", snap2.ui.stage.includes(snap2.db.winners[1]?.name ?? "___"), `stage=${JSON.stringify(snap2.ui.stage)} db=${snap2.db.winners[1]?.name}`);
    check("spin2: stage no longer shows winner 1", !snap2.ui.stage.includes(snap2.db.winners[0]?.name ?? "___"), `stage=${JSON.stringify(snap2.ui.stage)}`);
    check("spin2: names differ across spins", snap2.db.winners[0]?.name !== snap2.db.winners[1]?.name, JSON.stringify(snap2.db.winners.map((w) => w.name)));
    check("spin2: sidebar lists both in order", snap2.ui.lis.length === 2 && snap2.ui.lis[1]?.includes(snap2.db.winners[1]?.name ?? "___"), JSON.stringify(snap2.ui.lis));
    check("spin2: pool now 4", snap2.ui.pool === 4 && snap2.db.active.length === 4, `pool=${snap2.ui.pool}`);
    check("spin2: target extended to 2", snap2.db.target === 2 && snap2.db.status === "COMPLETED", `${snap2.db.status}/${snap2.db.target}`);

    let snap3 = await spin(cardId, "Draw another winner", 4500);
    check("spin3: third unique winner drawn", snap3.db.winners.length === 3 && new Set(snap3.db.winners.map((w) => w.name)).size === 3, JSON.stringify(snap3.db.winners.map((w) => w.name)));
    check("spin3: stage shows winner 3", snap3.ui.stage.includes(snap3.db.winners[2]?.name ?? "___"), `stage=${JSON.stringify(snap3.ui.stage)}`);
    check("spin3: pool now 3", snap3.ui.pool === 3 && snap3.db.active.length === 3, `pool=${snap3.ui.pool}`);
    check("spin3: sidebar lists all three", snap3.ui.lis.length === 3, JSON.stringify(snap3.ui.lis));

    // ---------- wheel draw: pointer must land on the true winner ----------
    console.log("\n=== wheel draw: spin twice ===");
    await send("Page.navigate", { url: `${BASE}/present/${wheelId}` });
    await waitFor(
      `Boolean(document.body) && document.body.innerText.includes("Remaining in Pool")`,
      "wheel present page ready",
    );
    const pointerIndex = (ui, activeNames) => {
      const m = /rotate\((-?[\d.]+)\s+120\s+120\)/.exec(ui.wheelTransform ?? "");
      if (!m) return -1;
      const deg = ((Number(m[1]) % 360) + 360) % 360;
      const pos = (360 - deg) % 360;
      return Math.floor(pos / (360 / Math.max(activeNames.length, 1)));
    };

    const wsnap = await spin(wheelId, "Draw Winner", 6000);
    const w1Names = revealNames(wsnap.db, wsnap.db.winners[0]);
    const w1Idx = w1Names.indexOf(wsnap.db.winners[0]?.name);
    check("wheel: stage shows the true winner", Boolean(wsnap.db.winners[0]) && wsnap.ui.stage.includes(wsnap.db.winners[0].name), `stage=${JSON.stringify(wsnap.ui.stage)} db=${wsnap.db.winners[0]?.name}`);
    check("wheel: pointer landed on the winner's wedge", pointerIndex(wsnap.ui, w1Names) === w1Idx, `pointer=${pointerIndex(wsnap.ui, w1Names)} expected=${w1Idx} transform=${wsnap.ui.wheelTransform}`);
    check("wheel: sidebar matches", wsnap.ui.lis[0]?.includes(wsnap.db.winners[0]?.name ?? "___"), JSON.stringify(wsnap.ui.lis));
    check("wheel: button offers in-place re-draw", wsnap.ui.buttons.some((b) => b.t.includes("Draw another winner") && !b.d), JSON.stringify(wsnap.ui.buttons.map((b) => b.t)));

    // second spin must NOT land on the previous winner's wedge (stale target)
    const wsnap2 = await spin(wheelId, "Draw another winner", 6000);
    const w2Names = revealNames(wsnap2.db, wsnap2.db.winners[1]);
    const w2Idx = w2Names.indexOf(wsnap2.db.winners[1]?.name);
    check("wheel spin2: two unique winners", wsnap2.db.winners.length === 2 && wsnap2.db.winners[0]?.name !== wsnap2.db.winners[1]?.name, JSON.stringify(wsnap2.db.winners.map((w) => w.name)));
    check("wheel spin2: stage shows winner 2", wsnap2.ui.stage.includes(wsnap2.db.winners[1]?.name ?? "___"), `stage=${JSON.stringify(wsnap2.ui.stage)}`);
    check("wheel spin2: pointer landed on winner 2's wedge", pointerIndex(wsnap2.ui, w2Names) === w2Idx, `pointer=${pointerIndex(wsnap2.ui, w2Names)} expected=${w2Idx} transform=${wsnap2.ui.wheelTransform}`);
    check("wheel spin2: sidebar lists both", wsnap2.ui.lis.length === 2 && wsnap2.ui.lis[1]?.includes(wsnap2.db.winners[1]?.name ?? "___"), JSON.stringify(wsnap2.ui.lis));

    // screenshot for the record
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(".tmp-spin.png", Buffer.from(shot.data, "base64"));
    console.log("\nscreenshot saved: .tmp-spin.png");
  } finally {
    try { ws?.close(); } catch {}
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/close/${encodeURIComponent("about:blank")}`).catch(() => {});
    } catch {}
    chrome.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log("Failures:\n - " + failures.join("\n - "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("CDE test crashed:", err);
  process.exit(2);
});
