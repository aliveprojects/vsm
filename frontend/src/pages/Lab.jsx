import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const DEFAULT_FORM = {
  scenarioId: "pet-carrier",
  nodeId: "boarding",
  id: "lab_option",
  text: "Предложить пассажиру пройти в тамбур и спокойно объяснить правило ещё раз",
  next: "resist",
  loyalty: 5,
  safety: 5,
  xp: 10,
  feedback: "Дополнительная сервисная развилка из лаборатории.",
};

export default function Lab() {
  const [scenarios, setScenarios] = useState([]);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.scenarios().then((d) => setScenarios(d.scenarios || []));
  }, []);

  useEffect(() => {
    if (!form.scenarioId) return;
    api.scenarioDetail(form.scenarioId).then((d) => {
      setDetail(d);
      const firstSituation = Object.entries(d.nodes || {}).find(
        ([, n]) => n.type === "situation"
      );
      if (firstSituation) {
        setForm((f) => ({
          ...f,
          nodeId: f.nodeId && d.nodes[f.nodeId] ? f.nodeId : firstSituation[0],
          next:
            f.next && d.nodes[f.next]
              ? f.next
              : firstSituation[1].choiceIds?.[0]
                ? Object.keys(d.nodes).find((id) => d.nodes[id].type === "ending") ||
                  firstSituation[0]
                : firstSituation[0],
        }));
      }
    });
  }, [form.scenarioId]);

  const situationNodes = useMemo(() => {
    if (!detail?.nodes) return [];
    return Object.entries(detail.nodes)
      .filter(([, n]) => n.type === "situation")
      .map(([id, n]) => ({ id, title: n.title || id, choiceIds: n.choiceIds || [] }));
  }, [detail]);

  const allNodeIds = useMemo(() => Object.keys(detail?.nodes || {}), [detail]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await api.addChoice(form.scenarioId, {
        nodeId: form.nodeId,
        choice: {
          id: form.id.trim(),
          text: form.text.trim(),
          next: form.next,
          effects: {
            loyalty: Number(form.loyalty),
            safety: Number(form.safety),
            xp: Number(form.xp),
          },
          feedback: form.feedback,
          tone: "neutral",
        },
      });
      setResult(data);
      const refreshed = await api.scenarioDetail(form.scenarioId);
      setDetail(refreshed);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page lab">
      <p className="eyebrow">Контент</p>
      <h1>Редактор сценариев</h1>
      <p className="lede">
        Добавьте новый вариант ответа в существующий узел. Изменения пишутся в JSON
        сценария и сразу доступны при следующем прохождении.
      </p>

      <form className="lab-form" onSubmit={submit}>
        <label>
          Сценарий
          <select
            className="select"
            value={form.scenarioId}
            onChange={(e) => setForm({ ...form, scenarioId: e.target.value })}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          Узел
          <select
            className="select"
            value={form.nodeId}
            onChange={(e) => setForm({ ...form, nodeId: e.target.value })}
          >
            {situationNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} · {n.title} ({n.choiceIds.length} выборов)
              </option>
            ))}
          </select>
        </label>

        <label>
          ID выбора
          <input
            className="select"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            required
          />
        </label>

        <label className="full">
          Текст выбора
          <textarea
            className="select"
            rows={3}
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            required
          />
        </label>

        <label>
          Следующий узел
          <select
            className="select"
            value={form.next}
            onChange={(e) => setForm({ ...form, next: e.target.value })}
          >
            {allNodeIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>

        <label>
          Δ лояльность
          <input
            className="select"
            type="number"
            value={form.loyalty}
            onChange={(e) => setForm({ ...form, loyalty: e.target.value })}
          />
        </label>
        <label>
          Δ безопасность
          <input
            className="select"
            type="number"
            value={form.safety}
            onChange={(e) => setForm({ ...form, safety: e.target.value })}
          />
        </label>
        <label>
          XP
          <input
            className="select"
            type="number"
            value={form.xp}
            onChange={(e) => setForm({ ...form, xp: e.target.value })}
          />
        </label>

        <label className="full">
          Feedback в debrief
          <input
            className="select"
            value={form.feedback}
            onChange={(e) => setForm({ ...form, feedback: e.target.value })}
          />
        </label>

        <div className="full hero-cta">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Пишем…" : "Добавить развилку в JSON"}
          </button>
          <Link className="btn ghost" to={`/play/${form.scenarioId}`}>
            Пройти сценарий
          </Link>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="flash">
          Готово: в узле <strong>{result.nodeId}</strong> теперь {result.choiceCount}{" "}
          выборов. Обновлён файл сценария.
        </div>
      )}

      <section className="lab-hint">
        <h2>Где править вручную</h2>
        <ul>
          <li>
            Движок: <code>backend/src/engine/scenarioEngine.js</code>
          </li>
          <li>
            API: <code>POST /api/scenarios/:id/choices</code>
          </li>
          <li>
            Файлы: <code>backend/data/scenarios/*.json</code>
          </li>
        </ul>
      </section>
    </div>
  );
}
