/**
 * Движок сценариев ВСМ.
 *
 * Сценарий — JSON-граф: узлы (situation | ending) и выборы с эффектами.
 * Состояние сессии: loyalty, safety, xp, history[], flags, currentNodeId.
 * Таймер: истечение → timeoutChoice (или первый выбор).
 * Ветвление: choice.next (строка) или { conditions: [...] }.
 */

const DEFAULT_LOYALTY = 50;
const DEFAULT_SAFETY = 50;

/**
 * @param {object} scenario
 * @param {object} [overrides]
 */
export function createSession(scenario, overrides = {}) {
  if (!scenario?.id || !scenario?.startNode || !scenario?.nodes) {
    throw new Error("Некорректный сценарий: нужны id, startNode, nodes");
  }
  const start = scenario.nodes[scenario.startNode];
  if (!start) {
    throw new Error(`Стартовый узел «${scenario.startNode}» не найден`);
  }

  return {
    scenarioId: scenario.id,
    currentNodeId: scenario.startNode,
    loyalty: overrides.loyalty ?? DEFAULT_LOYALTY,
    safety: overrides.safety ?? DEFAULT_SAFETY,
    xp: 0,
    flags: { ...(overrides.flags || {}) },
    history: [],
    status: "active", // active | completed | abandoned
    startedAt: new Date().toISOString(),
    finishedAt: null,
    nodeDeadline: computeDeadline(start),
  };
}

function computeDeadline(node) {
  if (!node?.timerSec || node.timerSec <= 0) return null;
  return Date.now() + node.timerSec * 1000;
}

/**
 * Публичное представление текущего узла (без «правильных» подсказок).
 */
export function presentNode(scenario, session) {
  const node = scenario.nodes[session.currentNodeId];
  if (!node) {
    throw new Error(`Узел «${session.currentNodeId}» отсутствует`);
  }

  const base = {
    nodeId: session.currentNodeId,
    type: node.type,
    title: node.title || null,
    text: node.text,
    image: node.image || null,
    imageHint: node.imageHint || null,
    competencyFocus: node.competencyFocus || [],
    loyalty: session.loyalty,
    safety: session.safety,
    xp: session.xp,
    status: session.status,
    timerSec: node.timerSec || null,
    deadlineAt: session.nodeDeadline,
    serverNow: Date.now(),
  };

  if (node.type === "ending" || session.status === "completed") {
    return {
      ...base,
      type: "ending",
      outcome: node.outcome || "done",
      summary: node.summary || node.text,
      choices: [],
    };
  }

  return {
    ...base,
    choices: (node.choices || []).map((c) => ({
      id: c.id,
      text: c.text,
    })),
  };
}

/**
 * Применить выбор (или таймаут). Возвращает обновлённую сессию + дельты.
 */
export function applyChoice(scenario, session, choiceId, { timedOut = false } = {}) {
  if (session.status !== "active") {
    throw new Error("Сессия уже завершена");
  }

  const node = scenario.nodes[session.currentNodeId];
  if (!node || node.type === "ending") {
    throw new Error("Нет активного узла для выбора");
  }

  let choice = (node.choices || []).find((c) => c.id === choiceId);

  if (timedOut || !choice) {
    const timeoutId = node.timeoutChoice || node.choices?.[0]?.id;
    choice = (node.choices || []).find((c) => c.id === timeoutId);
    if (!choice) {
      throw new Error("Не удалось определить выбор по таймауту");
    }
    timedOut = true;
  }

  const effects = {
    loyalty: choice.effects?.loyalty ?? 0,
    safety: choice.effects?.safety ?? 0,
    xp: choice.effects?.xp ?? 0,
  };

  const nextLoyalty = clamp(session.loyalty + effects.loyalty, 0, 100);
  const nextSafety = clamp(session.safety + effects.safety, 0, 100);
  const nextXp = session.xp + Math.max(0, effects.xp);
  const nextFlags = { ...session.flags, ...(choice.setFlags || {}) };

  const historyEntry = {
    nodeId: session.currentNodeId,
    choiceId: choice.id,
    choiceText: choice.text,
    timedOut,
    effects,
    loyaltyAfter: nextLoyalty,
    safetyAfter: nextSafety,
    feedback: choice.feedback || "",
    betterAlternative: choice.betterAlternative || null,
    competencyTags: choice.competencyTags || node.competencyFocus || [],
  };

  const nextNodeId = resolveNext(choice.next, {
    loyalty: nextLoyalty,
    safety: nextSafety,
    flags: nextFlags,
  });

  if (!scenario.nodes[nextNodeId]) {
    throw new Error(`Следующий узел «${nextNodeId}» не найден`);
  }

  const nextNode = scenario.nodes[nextNodeId];
  const completed = nextNode.type === "ending";

  const updated = {
    ...session,
    currentNodeId: nextNodeId,
    loyalty: nextLoyalty,
    safety: nextSafety,
    xp: nextXp,
    flags: nextFlags,
    history: [...session.history, historyEntry],
    status: completed ? "completed" : "active",
    finishedAt: completed ? new Date().toISOString() : null,
    nodeDeadline: completed ? null : computeDeadline(nextNode),
  };

  return { session: updated, historyEntry, timedOut };
}

/**
 * Разбор последствий после сценария.
 */
export function buildDebrief(scenario, session) {
  const ending = scenario.nodes[session.currentNodeId];
  const competencyScores = {};

  for (const step of session.history) {
    for (const tag of step.competencyTags || []) {
      if (!competencyScores[tag]) {
        competencyScores[tag] = { points: 0, decisions: 0 };
      }
      competencyScores[tag].decisions += 1;
      competencyScores[tag].points +=
        (step.effects?.loyalty || 0) + (step.effects?.safety || 0) + (step.effects?.xp || 0);
    }
  }

  const gaps = Object.entries(competencyScores)
    .map(([name, data]) => ({
      name,
      avgImpact: data.decisions ? data.points / data.decisions : 0,
      decisions: data.decisions,
    }))
    .sort((a, b) => a.avgImpact - b.avgImpact);

  const weak = gaps.filter((g) => g.avgImpact < 5).map((g) => g.name);
  const strong = gaps.filter((g) => g.avgImpact >= 10).map((g) => g.name);

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    outcome: ending?.outcome || "done",
    endingText: ending?.summary || ending?.text || "",
    finalLoyalty: session.loyalty,
    finalSafety: session.safety,
    xpEarned: session.xp,
    steps: session.history.map((h, index) => ({
      index: index + 1,
      nodeId: h.nodeId,
      choiceText: h.choiceText,
      timedOut: h.timedOut,
      effects: h.effects,
      feedback: h.feedback,
      betterAlternative: h.betterAlternative,
      competencyTags: h.competencyTags,
    })),
    competencies: {
      strong,
      weak,
      detail: competencyScores,
    },
    tips: buildTips(session, weak),
  };
}

function buildTips(session, weak) {
  const tips = [];
  if (session.history.some((h) => h.timedOut)) {
    tips.push(
      "В критических ситуациях таймер истёк: отработайте алгоритм «оценить угрозу → сообщить → действовать» быстрее."
    );
  }
  if (session.safety < 40) {
    tips.push(
      "Рейтинг безопасности просел: приоритет — жизнь, здоровье и регламент ПТБ, даже если пассажир давит на эмоции."
    );
  }
  if (session.loyalty < 40) {
    tips.push(
      "Лояльность пассажира низкая: чаще признавайте дискомфорт, предлагайте конкретную альтернативу и берите обратную связь."
    );
  }
  for (const w of weak.slice(0, 2)) {
    tips.push(`Компетенция «${w}» требует практики — повторите сценарии с этим фокусом.`);
  }
  if (!tips.length) {
    tips.push("Стабильный баланс сервиса и безопасности. Закрепите результат в следующем сценарии.");
  }
  return tips;
}

function resolveNext(next, ctx) {
  if (typeof next === "string") return next;
  if (!next || typeof next !== "object") {
    throw new Error("У выбора не указан next");
  }

  const conditions = next.conditions || [];
  for (const rule of conditions) {
    if (rule.else) continue;
    if (matches(rule.if, ctx)) return rule.goto;
  }
  const fallback = conditions.find((r) => r.else);
  if (fallback?.else) return fallback.else;
  if (next.default) return next.default;
  throw new Error("Не удалось разрешить ветвление next");
}

function matches(predicate, ctx) {
  if (!predicate) return true;
  for (const [key, rule] of Object.entries(predicate)) {
    if (key === "flag") {
      if (!ctx.flags?.[rule]) return false;
      continue;
    }
    if (key === "flags") {
      for (const [flag, expected] of Object.entries(rule)) {
        if (Boolean(ctx.flags?.[flag]) !== Boolean(expected)) return false;
      }
      continue;
    }
    const value = ctx[key];
    if (value === undefined) return false;
    if (typeof rule === "number") {
      if (value !== rule) return false;
      continue;
    }
    if (rule.gte !== undefined && !(value >= rule.gte)) return false;
    if (rule.lte !== undefined && !(value <= rule.lte)) return false;
    if (rule.gt !== undefined && !(value > rule.gt)) return false;
    if (rule.lt !== undefined && !(value < rule.lt)) return false;
    if (rule.eq !== undefined && value !== rule.eq) return false;
  }
  return true;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function validateScenario(scenario) {
  const errors = [];
  if (!scenario.id) errors.push("нет id");
  if (!scenario.startNode) errors.push("нет startNode");
  if (!scenario.nodes || typeof scenario.nodes !== "object") {
    errors.push("нет nodes");
    return errors;
  }
  if (!scenario.nodes[scenario.startNode]) {
    errors.push(`startNode «${scenario.startNode}» не существует`);
  }
  for (const [id, node] of Object.entries(scenario.nodes)) {
    if (!["situation", "ending"].includes(node.type)) {
      errors.push(`узел ${id}: неверный type`);
    }
    if (node.type === "situation") {
      if (!node.choices?.length) errors.push(`узел ${id}: нет choices`);
      for (const c of node.choices || []) {
        try {
          // dry-run resolve with mid scores
          resolveNext(c.next, { loyalty: 50, safety: 50, flags: {} });
        } catch (e) {
          errors.push(`узел ${id}, выбор ${c.id}: ${e.message}`);
        }
        const targets = collectTargets(c.next);
        for (const t of targets) {
          if (!scenario.nodes[t]) errors.push(`узел ${id}: ссылка на несуществующий ${t}`);
        }
      }
    }
  }
  return errors;
}

function collectTargets(next) {
  if (typeof next === "string") return [next];
  if (!next) return [];
  const out = [];
  if (next.default) out.push(next.default);
  for (const r of next.conditions || []) {
    if (r.goto) out.push(r.goto);
    if (r.else) out.push(r.else);
  }
  return out;
}
