const CLASSES = [
  {
    id: "first",
    title: "Первый класс",
    image: "/scenes/conductor-welcome.jpg",
    points: [
      "Повышенный уровень приватности и сервиса",
      "Горячие напитки и расширенное меню",
      "Приоритет при пересадках и комплиментах при сбоях оборудования",
    ],
  },
  {
    id: "business",
    title: "Бизнес",
    image: "/scenes/cabin-couple.jpg",
    points: [
      "Комфортная работа в дороге, розетки и мультимедиа",
      "Питание по меню / предзаказ",
      "Важно сохранять спокойную атмосферу салона",
    ],
  },
  {
    id: "base",
    title: "Базовый",
    image: "/scenes/cabin-seat.jpg",
    points: [
      "Основной поток пассажиров и частые сервисные запросы",
      "Строже контроль ручной клади и проходов",
      "Типовые конфликты: шум, места, питомцы, посадка",
    ],
  },
];

const ATMOSPHERE = [
  {
    src: "/scenes/open/bullet-train.jpg",
    title: "Состав ВСМ",
    caption: "Высокоскоростной подвижной состав",
  },
  {
    src: "/scenes/scene-platform-hsr.jpg",
    title: "Платформа",
    caption: "Посадка и контроль билетов",
  },
  {
    src: "/scenes/scene-bistro.jpg",
    title: "Бистро",
    caption: "Сервисная зона на борту",
  },
];

export default function Classes() {
  return (
    <div className="page classes">
      <p className="eyebrow">Справочник ВСМ</p>
      <h1>Классы обслуживания</h1>
      <p className="lede">
        Контекст для сценариев: решения проводника зависят от класса вагона, но безопасность
        всегда выше удобства.
      </p>

      <div className="gallery-grid classes-atmosphere">
        {ATMOSPHERE.map((item) => (
          <figure key={item.src} className="gallery-card">
            <img src={item.src} alt={item.title} />
            <figcaption>
              <strong>{item.title}</strong>
              <span>{item.caption}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="class-grid">
        {CLASSES.map((c) => (
          <article key={c.id} className="class-card">
            <div className="class-card-media">
              <img src={c.image} alt={c.title} />
            </div>
            <div className="class-card-body">
              <h2>{c.title}</h2>
              <ul>
                {c.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <section className="class-note">
        <h2>Как это связано с тренажёром</h2>
        <p className="muted">
          В сценариях указан <strong>classHint</strong>. Например, медицинский кейс чаще в бизнесе,
          посадка и питомцы — в базовом. Шкалы одни и те же: лояльность и безопасность.
        </p>
      </section>
    </div>
  );
}
