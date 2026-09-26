import { useEffect, useMemo, useState } from "react";

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [group, setGroup] = useState("Все");

  useEffect(() => {
    fetch("/scenes/gallery.json")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, []);

  const groups = useMemo(() => {
    const set = new Set(items.map((i) => i.group));
    return ["Все", ...[...set]];
  }, [items]);

  const visible = items.filter((i) => group === "Все" || i.group === group);

  return (
    <div className="page gallery">
      <p className="eyebrow">Медиатека тренажёра</p>
      <h1>Галерея</h1>
      <p className="lede">
        Кадры из материалов кейса ВСМ, иллюстрации сценариев и открытые фотографии
        высокоскоростного транспорта.
      </p>

      <div className="scope-tabs" style={{ marginBottom: 18 }}>
        {groups.map((g) => (
          <button
            key={g}
            className={group === g ? "btn primary" : "btn ghost"}
            onClick={() => setGroup(g)}
            type="button"
          >
            {g}
          </button>
        ))}
      </div>

      <div className="gallery-grid">
        {visible.map((item) => (
          <figure key={item.src} className="gallery-card">
            <img src={item.src} alt={item.title} loading="lazy" />
            <figcaption>
              <strong>{item.title}</strong>
              <span>{item.source}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
