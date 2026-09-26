export default function Meter({ label, value, tone = "loyalty", delta = null }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={`meter tone-${tone}`}>
      <div className="meter-head">
        <span>{label}</span>
        <strong>
          {v}
          {delta !== null && delta !== 0 && (
            <em className={delta > 0 ? "up" : "down"}>
              {delta > 0 ? `+${delta}` : delta}
            </em>
          )}
        </strong>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
