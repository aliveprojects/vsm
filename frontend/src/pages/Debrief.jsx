import { Link, useLocation } from "react-router-dom";
import Meter from "../components/Meter.jsx";

export default function Debrief() {
  const { state } = useLocation();
  const debrief = state?.debrief;
  const rewards = state?.rewards;

  if (!debrief) {
    return (
      <div className="page">
        <p>Нет данных разбора. Пройдите сценарий.</p>
        <Link className="btn primary" to="/">
          К сценариям
        </Link>
      </div>
    );
  }

  return (
    <div className="page debrief">
      <p className="eyebrow">Обратная связь</p>
      <h1>{debrief.title}</h1>
      <p className={`outcome outcome-${debrief.outcome}`}>{debrief.endingText}</p>

      <div className="legend-row">
        <Meter label="Итог · лояльность" value={debrief.finalLoyalty} tone="loyalty" />
        <Meter label="Итог · безопасность" value={debrief.finalSafety} tone="safety" />
      </div>

      {rewards && (
        <div className="reward-box">
          <div>
            <span>Получено XP</span>
            <strong>+{rewards.xpGain}</strong>
          </div>
          <div>
            <span>Уровень</span>
            <strong>{rewards.level?.level}</strong>
          </div>
          {rewards.newlyUnlocked?.length > 0 && (
            <div className="new-ach">
              {rewards.newlyUnlocked.map((a) => (
                <span key={a.id}>🏅 {a.title}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <section>
        <h2>Разбор решений</h2>
        <ol className="steps">
          {debrief.steps.map((s) => (
            <li key={s.index}>
              <div className="step-head">
                <strong>
                  Шаг {s.index}
                  {s.timedOut ? " · таймаут" : ""}
                </strong>
                <span>
                  L {fmt(s.effects.loyalty)} · S {fmt(s.effects.safety)} · XP {fmt(s.effects.xp)}
                </span>
              </div>
              <p className="choice-echo">{s.choiceText}</p>
              <p>{s.feedback}</p>
              {s.betterAlternative && (
                <p className="better">Как лучше: {s.betterAlternative}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Компетенции</h2>
        <p>
          Сильные: {(debrief.competencies.strong || []).join(", ") || "—"}
        </p>
        <p>
          Проседают: {(debrief.competencies.weak || []).join(", ") || "—"}
        </p>
        <ul className="tips">
          {(debrief.tips || []).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <div className="hero-cta">
        <Link className="btn primary" to="/">
          Ещё сценарий
        </Link>
        <Link className="btn ghost" to="/profile">
          Аналитика профиля
        </Link>
      </div>
    </div>
  );
}

function fmt(n) {
  if (n > 0) return `+${n}`;
  return `${n ?? 0}`;
}
