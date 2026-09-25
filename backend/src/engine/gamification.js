/**
 * Уровни, очки компетенций, ачивки, рейтинг.
 * Пороги XP задаются в LEVEL_THRESHOLDS ниже.
 */

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,
];

export function levelFromXp(totalXp) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const current = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? current + 800;
  return {
    level,
    totalXp,
    xpIntoLevel: totalXp - current,
    xpToNext: Math.max(0, next - totalXp),
    nextThreshold: next,
  };
}

export function applyRunRewards(user, debrief, achievementsCatalog) {
  const xpGain = debrief.xpEarned || 0;
  const competencyXp = { ...(user.competencyXp || {}) };

  for (const step of debrief.steps || []) {
    const impact =
      (step.effects?.loyalty || 0) +
      (step.effects?.safety || 0) +
      Math.max(0, step.effects?.xp || 0);
    for (const tag of step.competencyTags || []) {
      competencyXp[tag] = (competencyXp[tag] || 0) + Math.max(1, impact);
    }
  }

  const totalXp = (user.totalXp || 0) + xpGain;
  const runsCompleted = (user.runsCompleted || 0) + 1;
  const bestLoyalty = Math.max(user.bestLoyalty || 0, debrief.finalLoyalty);
  const bestSafety = Math.max(user.bestSafety || 0, debrief.finalSafety);

  const scenarioIds = new Set(user.completedScenarios || []);
  scenarioIds.add(debrief.scenarioId);

  const timedOutCount =
    (user.timedOutCount || 0) + debrief.steps.filter((s) => s.timedOut).length;

  const stats = {
    totalXp,
    runsCompleted,
    bestLoyalty,
    bestSafety,
    timedOutCount,
    completedScenarios: [...scenarioIds],
    competencyXp,
    perfectBalanceRuns:
      (user.perfectBalanceRuns || 0) +
      (debrief.finalLoyalty >= 70 && debrief.finalSafety >= 70 ? 1 : 0),
    criticalWins:
      (user.criticalWins || 0) +
      (debrief.outcome === "success" && debrief.finalSafety >= 60 ? 1 : 0),
  };

  const unlocked = evaluateAchievements(
    { ...user, ...stats },
    achievementsCatalog,
    user.achievements || []
  );

  const levelInfo = levelFromXp(totalXp);

  return {
    patch: {
      ...stats,
      level: levelInfo.level,
      achievements: unlocked.all,
    },
    newlyUnlocked: unlocked.newly,
    levelInfo,
    xpGain,
  };
}

function evaluateAchievements(stats, catalog, owned) {
  const ownedSet = new Set(owned);
  const newly = [];
  for (const a of catalog) {
    if (ownedSet.has(a.id)) continue;
    if (meets(a.rule, stats)) {
      ownedSet.add(a.id);
      newly.push(a);
    }
  }
  return { all: [...ownedSet], newly };
}

function meets(rule, stats) {
  if (!rule) return false;
  switch (rule.type) {
    case "runs":
      return (stats.runsCompleted || 0) >= rule.value;
    case "xp":
      return (stats.totalXp || 0) >= rule.value;
    case "scenarios_unique":
      return (stats.completedScenarios || []).length >= rule.value;
    case "best_safety":
      return (stats.bestSafety || 0) >= rule.value;
    case "best_loyalty":
      return (stats.bestLoyalty || 0) >= rule.value;
    case "perfect_balance":
      return (stats.perfectBalanceRuns || 0) >= rule.value;
    case "critical_wins":
      return (stats.criticalWins || 0) >= rule.value;
    case "competency":
      return (stats.competencyXp?.[rule.key] || 0) >= rule.value;
    case "no_timeout_run":
      // выдаётся отдельно при debrief без таймаутов — здесь через флаг
      return Boolean(stats._lastRunNoTimeout) && rule.value === true
        ? (stats.runsCompleted || 0) >= 1
        : false;
    default:
      return false;
  }
}

export function leaderboard(users, { scope = "company", brigadeId, depotId } = {}) {
  let list = [...users];
  if (scope === "brigade" && brigadeId) {
    list = list.filter((u) => u.brigadeId === brigadeId);
  } else if (scope === "depot" && depotId) {
    list = list.filter((u) => u.depotId === depotId);
  }

  return list
    .map((u) => ({
      id: u.id,
      displayName: u.displayName,
      brigadeId: u.brigadeId,
      depotId: u.depotId,
      level: u.level || levelFromXp(u.totalXp || 0).level,
      totalXp: u.totalXp || 0,
      runsCompleted: u.runsCompleted || 0,
      achievementsCount: (u.achievements || []).length,
    }))
    .sort((a, b) => b.totalXp - a.totalXp || b.runsCompleted - a.runsCompleted)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

export function analyticsForUser(user, runs) {
  const userRuns = runs.filter((r) => r.userId === user.id);
  const competencyXp = user.competencyXp || {};
  const entries = Object.entries(competencyXp).sort((a, b) => b[1] - a[1]);
  const strong = entries.slice(0, 3).map(([name, xp]) => ({ name, xp }));
  const weak = entries.slice(-3).reverse().map(([name, xp]) => ({ name, xp }));

  const avgLoyalty =
    userRuns.length === 0
      ? 0
      : Math.round(
          userRuns.reduce((s, r) => s + (r.finalLoyalty || 0), 0) / userRuns.length
        );
  const avgSafety =
    userRuns.length === 0
      ? 0
      : Math.round(
          userRuns.reduce((s, r) => s + (r.finalSafety || 0), 0) / userRuns.length
        );

  return {
    userId: user.id,
    level: levelFromXp(user.totalXp || 0),
    runsCompleted: user.runsCompleted || 0,
    avgLoyalty,
    avgSafety,
    competencies: { strong, weak, all: competencyXp },
    recentRuns: userRuns.slice(-5).reverse(),
    gaps: weak.filter((w) => w.xp < 30).map((w) => w.name),
  };
}
