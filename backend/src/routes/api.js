import { Router } from "express";
import { nanoid } from "nanoid";
import {
  addNotification,
  addRun,
  getNotifications,
  getRuns,
  getSession,
  getUser,
  getUsers,
  loadAchievements,
  loadScenarios,
  markNotificationsRead,
  resetUserFromSeed,
  saveScenario,
  saveSession,
  updateUser,
} from "../store/db.js";
import {
  applyChoice,
  buildDebrief,
  createSession,
  presentNode,
  validateScenario,
} from "../engine/scenarioEngine.js";
import {
  analyticsForUser,
  applyRunRewards,
  leaderboard,
  levelFromXp,
} from "../engine/gamification.js";

export function buildApiRouter() {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "vsm-conductor-api", ts: new Date().toISOString() });
  });

  router.get("/scenarios", (_req, res) => {
    const scenarios = Object.values(loadScenarios()).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      route: s.route,
      classHint: s.classHint,
      difficulty: s.difficulty,
      durationMin: s.durationMin,
      competencies: s.competencies,
      coverImage: s.coverImage || null,
    }));
    res.json({ scenarios });
  });

  router.get("/scenarios/:id", (req, res) => {
    const scenario = loadScenarios()[req.params.id];
    if (!scenario) return res.status(404).json({ error: "Сценарий не найден" });
    const errors = validateScenario(scenario);
    res.json({
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      route: scenario.route,
      difficulty: scenario.difficulty,
      competencies: scenario.competencies,
      nodeCount: Object.keys(scenario.nodes).length,
      startNode: scenario.startNode,
      nodes: Object.fromEntries(
        Object.entries(scenario.nodes).map(([id, node]) => [
          id,
          {
            type: node.type,
            title: node.title || null,
            timerSec: node.timerSec || null,
            choiceIds: (node.choices || []).map((c) => c.id),
          },
        ])
      ),
      validationErrors: errors,
    });
  });

  /**
   * Добавить выбор в узел сценария (пишет в JSON на диске).
   */
  router.post("/scenarios/:id/choices", (req, res) => {
    const scenarios = loadScenarios();
    const scenario = scenarios[req.params.id];
    if (!scenario) return res.status(404).json({ error: "Сценарий не найден" });

    const { nodeId, choice } = req.body || {};
    if (!nodeId || !choice?.id || !choice?.text || !choice?.next) {
      return res.status(400).json({
        error: "Нужны nodeId и choice { id, text, next, effects?, feedback? }",
      });
    }

    const node = scenario.nodes[nodeId];
    if (!node || node.type !== "situation") {
      return res.status(400).json({ error: "Узел не найден или не situation" });
    }
    if ((node.choices || []).some((c) => c.id === choice.id)) {
      return res.status(409).json({ error: `Выбор «${choice.id}» уже есть` });
    }

    const normalized = {
      id: choice.id,
      text: choice.text,
      tone: choice.tone || "neutral",
      effects: {
        loyalty: Number(choice.effects?.loyalty ?? 0),
        safety: Number(choice.effects?.safety ?? 0),
        xp: Number(choice.effects?.xp ?? 10),
      },
      competencyTags: choice.competencyTags || node.competencyFocus || [],
      feedback: choice.feedback || "Добавленная развилка (лаборатория).",
      betterAlternative: choice.betterAlternative || null,
      next: choice.next,
    };

    node.choices = [...(node.choices || []), normalized];
    const errors = validateScenario(scenario);
    if (errors.length) {
      return res.status(400).json({ error: "Сценарий стал невалидным", details: errors });
    }

    saveScenario(scenario);
    res.status(201).json({
      ok: true,
      scenarioId: scenario.id,
      nodeId,
      choice: { id: normalized.id, text: normalized.text },
      choiceCount: node.choices.length,
    });
  });

  router.get("/users", (_req, res) => {
    res.json({
      users: getUsers().map(publicUser),
    });
  });

  router.get("/users/:id", (req, res) => {
    const user = getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    const achievements = loadAchievements();
    const owned = new Set(user.achievements || []);
    res.json({
      user: publicUser(user),
      level: levelFromXp(user.totalXp || 0),
      achievements: achievements.map((a) => ({
        ...a,
        unlocked: owned.has(a.id),
      })),
    });
  });

  router.get("/users/:id/analytics", (req, res) => {
    const user = getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    res.json(analyticsForUser(user, getRuns()));
  });

  router.post("/users/:id/reset", (req, res) => {
    const user = resetUserFromSeed(req.params.id);
    if (!user) return res.status(404).json({ error: "Нет сида для этого пользователя" });
    addNotification({
      userId: user.id,
      type: "system",
      title: "Профиль сброшен",
      body: "Прогресс профиля возвращён к исходным значениям.",
    });
    res.json({
      user: publicUser(user),
      level: levelFromXp(user.totalXp || 0),
    });
  });

  router.get("/leaderboard", (req, res) => {
    const scope = req.query.scope || "company";
    const brigadeId = req.query.brigadeId;
    const depotId = req.query.depotId;
    res.json({
      scope,
      entries: leaderboard(getUsers(), { scope, brigadeId, depotId }),
    });
  });

  router.get("/achievements", (_req, res) => {
    res.json({ achievements: loadAchievements() });
  });

  router.get("/notifications/:userId", (req, res) => {
    res.json({ notifications: getNotifications(req.params.userId) });
  });

  router.post("/notifications/:userId/read", (req, res) => {
    markNotificationsRead(req.params.userId);
    res.json({ ok: true });
  });

  router.post("/sessions", (req, res) => {
    const { userId, scenarioId } = req.body || {};
    const user = getUser(userId);
    if (!user) return res.status(400).json({ error: "Нужен существующий userId" });
    const scenario = loadScenarios()[scenarioId];
    if (!scenario) return res.status(404).json({ error: "Сценарий не найден" });

    const errors = validateScenario(scenario);
    if (errors.length) {
      return res.status(500).json({ error: "Сценарий повреждён", details: errors });
    }

    const engineSession = createSession(scenario);
    const session = {
      id: nanoid(12),
      userId,
      ...engineSession,
    };
    saveSession(session);

    res.status(201).json({
      sessionId: session.id,
      presentation: presentNode(scenario, session),
    });
  });

  router.get("/sessions/:id", (req, res) => {
    const session = getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Сессия не найдена" });
    const scenario = loadScenarios()[session.scenarioId];
    if (!scenario) return res.status(404).json({ error: "Сценарий не найден" });

    // авто-таймаут при чтении, если дедлайн прошёл
    const maybe = maybeTimeout(scenario, session);
    res.json({
      sessionId: maybe.session.id,
      status: maybe.session.status,
      presentation: presentNode(scenario, maybe.session),
      timedOutApplied: maybe.timedOutApplied,
    });
  });

  router.post("/sessions/:id/choose", (req, res) => {
    const session = getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Сессия не найдена" });
    const scenario = loadScenarios()[session.scenarioId];
    if (!scenario) return res.status(404).json({ error: "Сценарий не найден" });

    let current = maybeTimeout(scenario, session).session;
    if (current.status !== "active") {
      return res.status(400).json({ error: "Сессия уже завершена", debrief: buildDebrief(scenario, current) });
    }

    const { choiceId } = req.body || {};
    if (!choiceId) return res.status(400).json({ error: "Нужен choiceId" });

    try {
      const result = applyChoice(scenario, current, choiceId, { timedOut: false });
      result.session.id = current.id;
      result.session.userId = current.userId;
      saveSession(result.session);

      if (result.session.status === "completed") {
        const finished = finalizeRun(result.session, scenario);
        return res.json({
          presentation: presentNode(scenario, result.session),
          lastStep: result.historyEntry,
          completed: true,
          ...finished,
        });
      }

      res.json({
        presentation: presentNode(scenario, result.session),
        lastStep: result.historyEntry,
        completed: false,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post("/sessions/:id/timeout", (req, res) => {
    const session = getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Сессия не найдена" });
    const scenario = loadScenarios()[session.scenarioId];
    if (!scenario) return res.status(404).json({ error: "Сценарий не найден" });
    if (session.status !== "active") {
      return res.status(400).json({ error: "Сессия уже завершена" });
    }

    try {
      const node = scenario.nodes[session.currentNodeId];
      const choiceId = node.timeoutChoice || node.choices?.[0]?.id;
      const result = applyChoice(scenario, session, choiceId, { timedOut: true });
      result.session.id = session.id;
      result.session.userId = session.userId;
      saveSession(result.session);

      if (result.session.status === "completed") {
        const finished = finalizeRun(result.session, scenario);
        return res.json({
          presentation: presentNode(scenario, result.session),
          lastStep: result.historyEntry,
          completed: true,
          timedOut: true,
          ...finished,
        });
      }

      res.json({
        presentation: presentNode(scenario, result.session),
        lastStep: result.historyEntry,
        completed: false,
        timedOut: true,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get("/sessions/:id/debrief", (req, res) => {
    const session = getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Сессия не найдена" });
    if (session.status !== "completed") {
      return res.status(400).json({ error: "Сценарий ещё не завершён" });
    }
    const scenario = loadScenarios()[session.scenarioId];
    res.json(buildDebrief(scenario, session));
  });

  /** Интеграционный stub для HR/LMS */
  router.get("/integrations/hr/export/:userId", (req, res) => {
    const user = getUser(req.params.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    const analytics = analyticsForUser(user, getRuns());
    res.json({
      format: "vsm-conductor.hr.v1",
      exportedAt: new Date().toISOString(),
      employeeSyntheticId: user.id,
      displayName: user.displayName,
      depotId: user.depotId,
      brigadeId: user.brigadeId,
      competencies: analytics.competencies,
      level: analytics.level,
      note: "Демо-данные без реальных персональных сведений.",
    });
  });

  return router;
}

function publicUser(u) {
  return {
    id: u.id,
    displayName: u.displayName,
    role: u.role,
    brigadeId: u.brigadeId,
    depotId: u.depotId,
    avatarColor: u.avatarColor,
    totalXp: u.totalXp || 0,
    level: u.level || levelFromXp(u.totalXp || 0).level,
    runsCompleted: u.runsCompleted || 0,
    achievementsCount: (u.achievements || []).length,
    completedScenarios: u.completedScenarios || [],
  };
}

function maybeTimeout(scenario, session) {
  if (session.status !== "active" || !session.nodeDeadline) {
    return { session, timedOutApplied: false };
  }
  if (Date.now() < session.nodeDeadline) {
    return { session, timedOutApplied: false };
  }
  const node = scenario.nodes[session.currentNodeId];
  const choiceId = node.timeoutChoice || node.choices?.[0]?.id;
  const result = applyChoice(scenario, session, choiceId, { timedOut: true });
  result.session.id = session.id;
  result.session.userId = session.userId;
  saveSession(result.session);
  if (result.session.status === "completed") {
    finalizeRun(result.session, scenario);
  }
  return { session: result.session, timedOutApplied: true };
}

function finalizeRun(session, scenario) {
  const debrief = buildDebrief(scenario, session);
  const user = getUser(session.userId);
  const catalog = loadAchievements();
  const noTimeout = !debrief.steps.some((s) => s.timedOut);
  const enrichedUser = { ...user, _lastRunNoTimeout: noTimeout };
  const rewards = applyRunRewards(enrichedUser, debrief, catalog);
  const updated = updateUser(session.userId, rewards.patch);

  addRun({
    id: nanoid(10),
    userId: session.userId,
    sessionId: session.id,
    scenarioId: scenario.id,
    outcome: debrief.outcome,
    finalLoyalty: debrief.finalLoyalty,
    finalSafety: debrief.finalSafety,
    xpEarned: debrief.xpEarned,
    finishedAt: session.finishedAt,
  });

  for (const a of rewards.newlyUnlocked) {
    addNotification({
      userId: session.userId,
      type: "achievement",
      title: `Ачивка: ${a.title}`,
      body: a.description,
    });
  }

  addNotification({
    userId: session.userId,
    type: "run_complete",
    title: `Сценарий «${scenario.title}» завершён`,
    body: `+${rewards.xpGain} XP · лояльность ${debrief.finalLoyalty} · безопасность ${debrief.finalSafety}`,
  });

  // демо-механика «сгорающих» баллов / челленджей
  if ((updated.totalXp || 0) > 0 && (updated.runsCompleted || 0) % 2 === 0) {
    addNotification({
      userId: session.userId,
      type: "challenge",
      title: "Челлендж бригады",
      body: "До конца суток сохраните баланс ≥ 70/70 в любом критическом сценарии — иначе недельный бонус бригады сгорит.",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
  }

  return {
    debrief,
    rewards: {
      xpGain: rewards.xpGain,
      level: rewards.levelInfo,
      newlyUnlocked: rewards.newlyUnlocked,
    },
    user: publicUser(updated),
  };
}
