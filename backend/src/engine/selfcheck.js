/**
 * Быстрая самопроверка движка (без тестового фреймворка).
 * Запуск: node backend/src/engine/selfcheck.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  applyChoice,
  buildDebrief,
  createSession,
  presentNode,
  validateScenario,
} from "./scenarioEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenariosDir = path.resolve(__dirname, "../../data/scenarios");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

const files = fs.readdirSync(scenariosDir).filter((f) => f.endsWith(".json"));
for (const file of files) {
  const scenario = JSON.parse(fs.readFileSync(path.join(scenariosDir, file), "utf8"));
  const errors = validateScenario(scenario);
  assert(errors.length === 0, `${scenario.id} валиден (${errors})`);
}

const medical = JSON.parse(
  fs.readFileSync(path.join(scenariosDir, "medical-emergency.json"), "utf8")
);
let session = createSession(medical);
let view = presentNode(medical, session);
assert(view.choices.length === 3, "стартовый узел отдаёт choices");
assert(!view.choices[0].effects, "effects не светятся клиенту");
assert(!view.choices.some((c) => "tone" in c || "feedback" in c), "оценка варианта не светится клиенту");

({ session } = applyChoice(medical, session, "protocol"));
assert(session.safety > 50, "protocol поднимает safety");
assert(session.history[0].feedback.length > 0, "feedback пишется в history");

({ session } = applyChoice(medical, session, "help_chain"));
({ session } = applyChoice(medical, session, "support_medic"));
assert(session.status === "completed", "успешный путь завершает сценарий");
const debrief = buildDebrief(medical, session);
assert(debrief.steps.length === 3, "debrief содержит 3 шага");
assert(debrief.outcome === "success", "outcome success");

// таймаут
session = createSession(medical);
({ session } = applyChoice(medical, session, "protocol", { timedOut: true }));
assert(session.history[0].timedOut === true, "флаг timedOut");

if (failed) {
  console.error(`\n${failed} проверок провалено`);
  process.exit(1);
}
console.log("\nВсе проверки движка пройдены");
