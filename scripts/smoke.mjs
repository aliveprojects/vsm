#!/usr/bin/env node
/**
 * Сквозной smoke: health → сценарии → сессия → выбор → complete.
 * Запуск при живом API: node scripts/smoke.mjs
 */
const API = process.env.API_URL || "http://localhost:8787/api";

async function req(path, options) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${data.error || ""}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  console.log("ok:", msg);
}

const health = await req("/health");
assert(health.ok, "health");

const { scenarios } = await req("/scenarios");
assert(scenarios.length >= 7, `сценариев ≥ 7 (сейчас ${scenarios.length})`);

const started = await req("/sessions", {
  method: "POST",
  body: JSON.stringify({ userId: "u-maria", scenarioId: "unattended-bag" }),
});
assert(started.sessionId, "сессия создана");
assert(started.presentation.choices?.length > 0, "есть варианты ответа");

let cur = started;
const path = ["secure", "perimeter", "hold"];
for (const choiceId of path) {
  cur = await req(`/sessions/${started.sessionId}/choose`, {
    method: "POST",
    body: JSON.stringify({ choiceId }),
  });
  console.log(" →", cur.presentation.nodeId, "L", cur.presentation.loyalty, "S", cur.presentation.safety);
}

assert(cur.completed === true, "сценарий завершён");
assert(cur.debrief?.steps?.length === 3, "debrief с 3 шагами");
assert(cur.rewards?.xpGain >= 0, "начислены награды");

console.log("\nSmoke OK");
