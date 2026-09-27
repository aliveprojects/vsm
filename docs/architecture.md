# Архитектура

Проводник.400 — одностраничное веб-приложение (React) и REST API (Node.js + Express). Сценарии, профили и сессии хранятся в JSON-файлах. Вся игровая логика (ветвления, таймер, эффекты, разбор) выполняется на сервере: клиент только показывает текущий узел и отправляет выбор.

## Диаграмма компонентов

```mermaid
flowchart LR
  subgraph Client["Браузер"]
    UI["React UI<br/>Vite · React Router"]
  end

  subgraph Server["Node.js · Express"]
    API["routes/api.js<br/>REST /api"]
    ENG["engine/scenarioEngine.js<br/>граф, таймер, ветвление, debrief"]
    GAM["engine/gamification.js<br/>XP, уровни, ачивки, рейтинг"]
    DB["store/db.js<br/>чтение и запись JSON"]
    DOCS["openapi.yaml<br/>Swagger UI /api/docs"]
  end

  subgraph Data["backend/data"]
    SC[("scenarios/*.json<br/>сценарии")]
    SEED[("seed/*.json<br/>демо-профили, ачивки")]
    RT[("runtime/*.json<br/>users, sessions, runs,<br/>notifications")]
  end

  HR["HR / LMS<br/>(внешняя система)"]

  UI -- "HTTP JSON" --> API
  API --> ENG
  API --> GAM
  API --> DB
  API -.-> DOCS
  DB --> SC
  DB --> SEED
  DB --> RT
  API -- "GET /integrations/hr/export/:userId" --> HR
```

| Компонент | Файл | Назначение |
|-----------|------|------------|
| UI | `frontend/src/` | Каталог, игровой экран, разбор, профиль, рейтинг, редактор |
| HTTP API | `backend/src/routes/api.js` | Роуты, валидация входа, коды ошибок |
| Движок сценариев | `backend/src/engine/scenarioEngine.js` | Граф узлов, таймер, условия переходов, флаги, debrief, валидация графа |
| Геймификация | `backend/src/engine/gamification.js` | XP, 10 уровней, 9 ачивок, компетенции, лидерборд |
| Хранилище | `backend/src/store/db.js` | Чтение сценариев и сидов, запись runtime-данных |
| Контракт API | `backend/src/openapi.yaml` | OpenAPI 3, отдаётся в Swagger UI и `/api/openapi.json` |
| Точка входа | `backend/src/index.js` | Express, заголовки безопасности, раздача собранного фронтенда |

В режиме разработки фронтенд работает на Vite (порт 5173) и проксирует `/api` на `:8787`. В прод-сборке Express сам раздаёт `frontend/dist`, и всё приложение доступно на одном порту.

## Последовательность: старт сессии

```mermaid
sequenceDiagram
  actor P as Проводник
  participant FE as Frontend
  participant API as API /sessions
  participant ENG as scenarioEngine
  participant DB as store (JSON)

  P->>FE: Выбирает сценарий в каталоге
  FE->>API: POST /api/sessions {userId, scenarioId}
  API->>DB: loadScenarios(), getUser()
  API->>ENG: createSession(scenario)
  Note over ENG: loyalty = safety = 50<br/>currentNode = startNode<br/>nodeDeadline = now + timerSec
  ENG-->>API: состояние сессии
  API->>DB: saveSession()
  API-->>FE: sessionId + presentation<br/>(текст, варианты без эффектов, deadlineAt, serverNow)
  FE-->>P: Кадр ситуации, шкалы, таймер
```

## Последовательность: решение игрока

```mermaid
sequenceDiagram
  actor P as Проводник
  participant FE as Frontend
  participant API as API /sessions
  participant ENG as scenarioEngine
  participant GAM as gamification
  participant DB as store (JSON)

  P->>FE: Выбирает вариант (или истекает таймер)
  FE->>API: POST /sessions/{id}/choose {choiceId} или /timeout
  API->>DB: getSession(id)
  API->>ENG: maybeTimeout() → applyChoice(scenario, session, choiceId)
  Note over ENG: 1) дедлайн прошёл? → timeoutChoice<br/>2) effects → шкалы, clamp 0..100<br/>3) setFlags → флаги сессии<br/>4) next.conditions по шкалам и флагам<br/>5) узел ending? → completed
  ENG-->>API: новое состояние + historyEntry (feedback)
  API->>DB: saveSession()
  alt финал
    API->>ENG: buildDebrief()
    API->>GAM: finalizeRun()
    GAM->>DB: runs, totalXp, уровень, ачивки, уведомления
    GAM-->>API: награды (XP, уровень, новые ачивки) + debrief
  end
  API-->>FE: следующий узел (варианты без оценок) + lastStep + изменения шкал
  FE-->>P: Комментарий, анимация шкал / экран разбора
```

Если клиент опоздал с ответом, `GET /sessions/{id}` после дедлайна сам применяет таймаут. Перезагрузка страницы время не продлевает.

## Ключевые решения

| Решение | Почему |
|---------|--------|
| Состояние сессии хранится в хранилище (`runtime/sessions.json`), а не в памяти процесса | Перезапуск сервера не обрывает прохождение. При переходе на БД API можно масштабировать горизонтально |
| Таймер проверяется на сервере (`nodeDeadline`) | Клиент не может «остановить время». Клиентский таймер нужен только для отображения, `serverNow` компенсирует расхождение часов |
| Эффекты, `feedback` и оценка варианта не отдаются во время игры | Правильный ответ нельзя подсмотреть в DevTools. Пояснения приходят только после выбора |
| Шкалы ограничены диапазоном 0..100 | Одна ошибка не уводит шкалу «в минус», итоги сопоставимы между сценариями |
| Переходы могут зависеть от шкал и флагов, а не только от выбора | Исход определяется траекторией: например, чужие лекарства (`illegalMeds`) ведут к провалу даже при честном финальном ответе |
| Сценарии — отдельные JSON-файлы, ядро не знает о конкретных кейсах | Методист добавляет кейс или развилку без правки кода и пересборки |
| Граф валидируется при старте и при каждой правке из редактора | Битая ссылка или узел без вариантов не попадают к проводнику |
| Вся работа с файлами — только в `store/db.js` | Замена JSON на PostgreSQL не затрагивает роуты и движок |
| Две независимые шкалы вместо одного балла | Сервис и безопасность конфликтуют. Один балл скрыл бы решения «приятно пассажиру, но опасно» |

## Модель сценария

Сценарий — это ориентированный граф. Узел имеет тип `situation` (с вариантами выбора) или `ending` (итог: `success`, `partial` или `fail`).

```mermaid
flowchart LR
  N["situation<br/>title, text, timerSec,<br/>timeoutChoice, image"] -->|choice.next| N2["situation"]
  N -->|"choice.next.conditions<br/>(шкалы, флаги)"| END["ending<br/>outcome"]
```

Вариант выбора (`choices[]`) содержит:

- `effects` — дельты `loyalty`, `safety`, `xp`;
- `feedback` и `betterAlternative` — пояснение для разбора;
- `competencyTags` — к каким компетенциям относится решение;
- `setFlags` — флаги сессии (например, `illegalMeds`);
- `next` — id узла или `{ conditions: [{ if: {...}, goto }, { else }] }`.

Условия поддерживают пороги шкал (`gte`, `lte`) и значения флагов.

При старте API каждый сценарий проходит `validateScenario()`: проверяются существование `startNode`, типы узлов, наличие вариантов и ссылки на существующие узлы. Та же проверка выполняется при добавлении развилки через редактор: невалидный граф не записывается.

## Хранение данных

| Каталог | Содержимое | В git |
|---------|------------|-------|
| `backend/data/scenarios/` | 9 сценариев | да |
| `backend/data/seed/` | 4 демо-профиля, 9 ачивок | да |
| `backend/data/runtime/` | прогресс, сессии, прогоны, уведомления | нет (`.gitignore`) |

Runtime-каталог создаётся автоматически из сидов при первом запуске. `store/db.js` — единственный модуль, который работает с файлами. Поэтому переход на PostgreSQL затрагивает только его, роуты и движок не меняются.

## Безопасность демо

- Клиент не получает `effects`, `feedback` и оценку варианта до выбора, так что по ответу API нельзя вычислить правильный вариант.
- Дедлайн узла хранится на сервере.
- Заголовки `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- Тело запроса ограничено 1 МБ.
- В сидах только вымышленные сотрудники. Секретов в репозитории нет.
