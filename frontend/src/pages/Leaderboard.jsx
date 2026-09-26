import { useEffect, useState } from "react";
import { api } from "../api";
import { useConductor } from "../state.jsx";

export default function Leaderboard() {
  const { profile } = useConductor();
  const [scope, setScope] = useState("company");
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const params = { scope };
    if (scope === "brigade") params.brigadeId = profile?.user?.brigadeId;
    if (scope === "depot") params.depotId = profile?.user?.depotId;
    api.leaderboard(params).then((d) => setEntries(d.entries || []));
  }, [scope, profile]);

  return (
    <div className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">Геймификация</p>
          <h1>Таблица лидеров</h1>
        </div>
        <div className="scope-tabs">
          {[
            ["company", "Компания"],
            ["depot", "Депо"],
            ["brigade", "Бригада"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={scope === id ? "btn primary" : "btn ghost"}
              onClick={() => setScope(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <table className="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Проводник</th>
            <th>Бригада</th>
            <th>Ур.</th>
            <th>XP</th>
            <th>Ачивки</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className={e.id === profile?.user?.id ? "me" : ""}>
              <td>{e.rank}</td>
              <td>{e.displayName}</td>
              <td>{e.brigadeId}</td>
              <td>{e.level}</td>
              <td>{e.totalXp}</td>
              <td>{e.achievementsCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
