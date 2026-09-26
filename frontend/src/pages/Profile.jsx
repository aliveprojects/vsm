import { useEffect, useState } from "react";
import { api } from "../api";
import { useConductor } from "../state.jsx";

export default function Profile() {
  const { userId, profile, setUserId, refresh } = useConductor();
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [hr, setHr] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.users().then((d) => setUsers(d.users || []));
  }, []);

  useEffect(() => {
    api.analytics(userId).then(setAnalytics).catch(() => setAnalytics(null));
    setHr(null);
    setMsg("");
  }, [userId, profile]);

  if (!profile) return <div className="page muted">Загрузка профиля…</div>;

  const u = profile.user;
  const level = profile.level;

  async function onReset() {
    if (!confirm("Сбросить прогресс этого профиля?")) return;
    await api.resetUser(userId);
    setMsg("Профиль сброшен.");
    refresh();
  }

  async function onHr() {
    const data = await api.hrExport(userId);
    setHr(data);
  }

  return (
    <div className="page profile">
      <div className="section-head">
        <div>
          <p className="eyebrow">Игровой профиль</p>
          <h1>{u.displayName}</h1>
          <p className="muted">
            {u.role} · {u.brigadeId} · {u.depotId}
          </p>
        </div>
        <select className="select" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {users.map((x) => (
            <option key={x.id} value={x.id}>
              {x.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="hero-cta" style={{ marginBottom: 18 }}>
        <button className="btn ghost" type="button" onClick={onHr}>
          Экспорт для HR/LMS
        </button>
        <button className="btn ghost" type="button" onClick={onReset}>
          Сбросить прогресс
        </button>
      </div>
      {msg && <p className="flash">{msg}</p>}

      <div className="mini-stats wide">
        <div>
          <span>Уровень</span>
          <strong>{level?.level ?? u.level}</strong>
        </div>
        <div>
          <span>Всего XP</span>
          <strong>{u.totalXp}</strong>
        </div>
        <div>
          <span>До следующего</span>
          <strong>{level?.xpToNext ?? "—"}</strong>
        </div>
        <div>
          <span>Сценариев</span>
          <strong>{u.runsCompleted}</strong>
        </div>
      </div>

      <section>
        <h2>Достижения</h2>
        <div className="ach-grid">
          {(profile.achievements || []).map((a) => (
            <article key={a.id} className={a.unlocked ? "ach on" : "ach off"}>
              <strong>{a.title}</strong>
              <p>{a.description}</p>
            </article>
          ))}
        </div>
      </section>

      {analytics && (
        <section>
          <h2>Аналитика компетенций</h2>
          <p className="muted">
            Средние итоги: лояльность {analytics.avgLoyalty}, безопасность {analytics.avgSafety}
          </p>
          <div className="comp-cols">
            <div>
              <h3>Сильные</h3>
              <ul>
                {(analytics.competencies.strong || []).map((c) => (
                  <li key={c.name}>
                    {c.name} · {c.xp}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Пробелы</h3>
              <ul>
                {(analytics.gaps || []).length
                  ? analytics.gaps.map((g) => <li key={g}>{g}</li>)
                  : (analytics.competencies.weak || []).map((c) => (
                      <li key={c.name}>
                        {c.name} · {c.xp}
                      </li>
                    ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {hr && (
        <section>
          <h2>Пакет HR (demo)</h2>
          <pre className="code-block">{JSON.stringify(hr, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
