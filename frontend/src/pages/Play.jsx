import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useConductor } from "../state.jsx";
import Meter from "../components/Meter.jsx";

export default function Play() {
  const { scenarioId } = useParams();
  const { userId, refresh } = useConductor();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(null);
  const [node, setNode] = useState(null);
  const [flash, setFlash] = useState(null);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [busy, setBusy] = useState(false);
  const prevScores = useRef({ loyalty: 50, safety: 50 });
  const timeoutSent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBusy(true);
        const data = await api.startSession(userId, scenarioId);
        if (cancelled) return;
        setSessionId(data.sessionId);
        setNode(data.presentation);
        prevScores.current = {
          loyalty: data.presentation.loyalty,
          safety: data.presentation.safety,
        };
        timeoutSent.current = false;
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, scenarioId]);

  useEffect(() => {
    if (!node?.deadlineAt || node.type === "ending") {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((node.deadlineAt - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [node]);

  useEffect(() => {
    if (secondsLeft !== 0 || !sessionId || timeoutSent.current || busy) return;
    timeoutSent.current = true;
    handleTimeout();
  }, [secondsLeft, sessionId]);

  async function applyResult(data) {
    const deltas = {
      loyalty: data.presentation.loyalty - prevScores.current.loyalty,
      safety: data.presentation.safety - prevScores.current.safety,
    };
    prevScores.current = {
      loyalty: data.presentation.loyalty,
      safety: data.presentation.safety,
    };
    setFlash({
      text: data.lastStep?.feedback,
      timedOut: data.timedOut || data.lastStep?.timedOut,
      deltas,
    });
    setNode(data.presentation);
    timeoutSent.current = false;

    if (data.completed) {
      await refresh();
      navigate("/debrief", {
        state: {
          debrief: data.debrief,
          rewards: data.rewards,
          scenarioId,
        },
      });
    }
  }

  async function choose(choiceId) {
    if (busy || !sessionId) return;
    setBusy(true);
    setError("");
    try {
      const data = await api.choose(sessionId, choiceId);
      await applyResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTimeout() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const data = await api.timeout(sessionId);
      await applyResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const timerCritical = secondsLeft !== null && secondsLeft <= 8;

  const sceneClass = useMemo(() => {
    if (!node) return "";
    return node.imageHint ? `scene-${node.imageHint}` : "scene-default";
  }, [node]);

  if (error && !node) {
    return (
      <div className="page">
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="page">
        <p className="muted">Загрузка сценария…</p>
      </div>
    );
  }

  return (
    <div className={`page play ${sceneClass}`}>
      <div className="play-layout">
        <aside className="play-meters">
          <Meter
            label="Лояльность"
            value={node.loyalty}
            tone="loyalty"
            delta={flash?.deltas?.loyalty ?? null}
          />
          <Meter
            label="Безопасность"
            value={node.safety}
            tone="safety"
            delta={flash?.deltas?.safety ?? null}
          />
          <div className="xp-pill">XP сессии: {node.xp}</div>
          {secondsLeft !== null && (
            <div className={`timer ${timerCritical ? "critical" : ""}`}>
              <span>Решение</span>
              <strong>{secondsLeft}с</strong>
            </div>
          )}
        </aside>

        <section className="play-stage">
          {node.image && (
            <div className="play-visual">
              <img src={node.image} alt="" />
            </div>
          )}
          {node.title && <p className="eyebrow">{node.title}</p>}
          <h1>{node.type === "ending" ? "Итог" : "Ситуация на борту"}</h1>
          <p className="situation-text">{node.text}</p>

          {flash?.text && (
            <div className={`flash ${flash.timedOut ? "warn" : ""}`}>
              {flash.timedOut && <strong>Время вышло. </strong>}
              {flash.text}
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="choices">
            {(node.choices || []).map((c) => (
              <button
                key={c.id}
                className={`choice tone-${c.tone || "neutral"}`}
                disabled={busy}
                onClick={() => choose(c.id)}
              >
                {c.text}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
