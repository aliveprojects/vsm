import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useConductor } from "../state.jsx";
import Meter from "../components/Meter.jsx";

export default function Home() {
  const { profile, notifications, setUserId, userId, refresh } = useConductor();
  const [scenarios, setScenarios] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.scenarios().then((d) => setScenarios(d.scenarios || []));
    api.users().then((d) => setUsers(d.users || []));
  }, []);

  const unread = (notifications || []).filter((n) => !n.read).slice(0, 3);

  return (
    <div className="page home">
      <section className="hero hero-visual">
        <div className="hero-copy">
          <p className="eyebrow">ВСМ-400 · обучение без риска для пассажиров</p>
          <h1>Решения на скорости</h1>
          <p className="lede">
            Нелинейные сценарии с таймером, двойной шкалой лояльности и безопасности
            и разбором каждого шага.
          </p>
          <div className="hero-cta">
            <a className="btn primary" href="#catalog">
              Выбрать сценарий
            </a>
            <Link className="btn ghost" to="/lab">
              Редактор сценариев
            </Link>
          </div>
        </div>
        <div className="hero-panel hero-photo">
          <img src="/scenes/conductor-welcome.jpg" alt="Проводник ВСМ встречает пассажира" />
          <div className="hero-photo-overlay">
            <p className="panel-label">Активный профиль</p>
            <select
              className="select"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} · {u.brigadeId} · ур. {u.level}
                </option>
              ))}
            </select>
            {profile && (
              <div className="mini-stats">
                <div>
                  <span>Уровень</span>
                  <strong>{profile.level?.level ?? profile.user.level}</strong>
                </div>
                <div>
                  <span>XP</span>
                  <strong>{profile.user.totalXp}</strong>
                </div>
                <div>
                  <span>Ачивки</span>
                  <strong>{profile.user.achievementsCount}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="route-strip">
        <img src="/scenes/route-map.jpg" alt="Маршрут ВСМ Санкт-Петербург — Москва" />
        <div>
          <p className="eyebrow">Маршрут тренажёра</p>
          <h2>Санкт-Петербург — Москва</h2>
          <p className="muted">Сценарии опираются на регламенты посадки и работы на борту ВСМ-400.</p>
        </div>
      </section>

      {unread.length > 0 && (
        <section className="notify-strip">
          <div className="section-head">
            <h2>Уведомления</h2>
            <button
              className="linkish"
              onClick={async () => {
                await api.readNotifications(userId);
                refresh();
              }}
            >
              Отметить прочитанными
            </button>
          </div>
          <ul>
            {unread.map((n) => (
              <li key={n.id}>
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="catalog" className="catalog">
        <div className="section-head">
          <h2>Сценарии смены</h2>
          <p>Ветвления, таймеры и влияние на обе шкалы — не линейный тест.</p>
        </div>
        <div className="scenario-grid">
          {scenarios.map((s) => (
            <article key={s.id} className={`scenario-card difficulty-${s.difficulty}`}>
              {s.coverImage && (
                <div className="sc-cover">
                  <img src={s.coverImage} alt="" />
                </div>
              )}
              <div className="sc-body">
                <div className="sc-top">
                  <span className="pill">{s.difficulty === "critical" ? "Критический" : "Стандарт"}</span>
                  <span className="muted">{s.durationMin} мин</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <div className="tags">
                  {(s.competencies || []).map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                <div className="sc-meta">
                  <span>{s.route}</span>
                  <span>{s.classHint}</span>
                </div>
                <Link className="btn primary block" to={`/play/${s.id}`}>
                  Начать
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="legend">
        <h2>Как читаются шкалы</h2>
        <div className="legend-row">
          <Meter label="Лояльность пассажира" value={72} tone="loyalty" />
          <Meter label="Рейтинг безопасности" value={64} tone="safety" />
        </div>
        <p className="muted">
          Одно и то же решение может поднять сервис и одновременно снизить безопасность —
          и наоборот. Итог сценария зависит от траектории, не от одного «правильного» ответа.
        </p>
      </section>
    </div>
  );
}
