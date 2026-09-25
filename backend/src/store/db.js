import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, "../../data");
const RUNTIME_DIR = path.join(DATA_ROOT, "runtime");
const SCENARIOS_DIR = path.join(DATA_ROOT, "scenarios");
const SEED_DIR = path.join(DATA_ROOT, "seed");

function ensureRuntime() {
  if (!fs.existsSync(RUNTIME_DIR)) fs.mkdirSync(RUNTIME_DIR, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureRuntime();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function dbPath(name) {
  return path.join(RUNTIME_DIR, `${name}.json`);
}

export function loadScenarios() {
  const files = fs.readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith(".json"));
  const map = {};
  for (const file of files) {
    const raw = readJson(path.join(SCENARIOS_DIR, file), null);
    if (raw?.id) map[raw.id] = raw;
  }
  return map;
}

export function loadAchievements() {
  return readJson(path.join(SEED_DIR, "achievements.json"), []);
}

export function initStore() {
  ensureRuntime();
  const usersFile = dbPath("users");
  if (!fs.existsSync(usersFile)) {
    const seed = readJson(path.join(SEED_DIR, "users.json"), []);
    writeJson(usersFile, seed);
  }
  for (const name of ["sessions", "notifications", "runs"]) {
    const f = dbPath(name);
    if (!fs.existsSync(f)) writeJson(f, name === "sessions" ? {} : []);
  }

  const notificationsFile = dbPath("notifications");
  const existing = readJson(notificationsFile, []);
  if (existing.length === 0) {
    const welcome = [
      {
        id: nanoid(10),
        userId: "u-maria",
        type: "scenario",
        title: "Новый сценарий смены",
        body: "Доступен критический кейс «Пассажиру стало плохо» — таймер 25 секунд.",
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: nanoid(10),
        userId: "u-maria",
        type: "challenge",
        title: "Челлендж бригады · сгорает завтра",
        body: "Закройте любой сценарий с балансом ≥ 70/70, иначе недельный бонус бригады сгорит.",
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        read: false,
        createdAt: new Date().toISOString(),
      },
    ];
    writeJson(notificationsFile, welcome);
  }
}

export function saveScenario(scenario) {
  if (!scenario?.id) throw new Error("У сценария нет id");
  const file = path.join(SCENARIOS_DIR, `${scenario.id}.json`);
  writeJson(file, scenario);
  return scenario;
}

export function getScenarioSourcePath(id) {
  return path.join(SCENARIOS_DIR, `${id}.json`);
}

export function getUsers() {
  return readJson(dbPath("users"), []);
}

export function saveUsers(users) {
  writeJson(dbPath("users"), users);
}

export function getUser(id) {
  return getUsers().find((u) => u.id === id) || null;
}

export function resetUserFromSeed(id) {
  const seedUsers = readJson(path.join(SEED_DIR, "users.json"), []);
  const seed = seedUsers.find((u) => u.id === id);
  if (!seed) return null;
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  const fresh = {
    ...seed,
    updatedAt: new Date().toISOString(),
    resetAt: new Date().toISOString(),
  };
  if (idx >= 0) users[idx] = fresh;
  else users.push(fresh);
  saveUsers(users);
  return fresh;
}

export function updateUser(id, patch) {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], ...patch, updatedAt: new Date().toISOString() };
  saveUsers(users);
  return users[idx];
}

export function getSessions() {
  return readJson(dbPath("sessions"), {});
}

export function saveSession(session) {
  const all = getSessions();
  all[session.id] = session;
  writeJson(dbPath("sessions"), all);
  return session;
}

export function getSession(id) {
  return getSessions()[id] || null;
}

export function getRuns() {
  return readJson(dbPath("runs"), []);
}

export function addRun(run) {
  const runs = getRuns();
  runs.push(run);
  writeJson(dbPath("runs"), runs);
  return run;
}

export function getNotifications(userId) {
  return readJson(dbPath("notifications"), []).filter((n) => n.userId === userId);
}

export function addNotification(notification) {
  const all = readJson(dbPath("notifications"), []);
  const item = {
    id: nanoid(10),
    createdAt: new Date().toISOString(),
    read: false,
    ...notification,
  };
  all.unshift(item);
  writeJson(dbPath("notifications"), all);
  return item;
}

export function markNotificationsRead(userId) {
  const all = readJson(dbPath("notifications"), []);
  for (const n of all) {
    if (n.userId === userId) n.read = true;
  }
  writeJson(dbPath("notifications"), all);
}

export { DATA_ROOT, RUNTIME_DIR };
