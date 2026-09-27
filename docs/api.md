# API Проводник.400

Базовый URL: `http://localhost:8787/api`

Контракт OpenAPI 3: [`backend/src/openapi.yaml`](../backend/src/openapi.yaml).

- Интерактивно: [Swagger UI](http://localhost:8787/api/docs), там же можно отправлять запросы.
- В JSON: `GET /api/openapi.json`.

Все запросы и ответы — JSON. Авторизации в демо нет: пользователь передаётся через `userId`.

## Методы

### Служебные

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Проверка живости: `{ ok, service, ts }` |

### Сценарии

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/scenarios` | Каталог: id, название, сложность, длительность, компетенции, обложка |
| GET | `/scenarios/{id}` | Метаданные сценария + результат валидации графа |
| POST | `/scenarios/{id}/choices` | Добавить развилку в узел (используется экраном «Редактор») |

### Сессии — игровой цикл

| Метод | Путь | Тело | Описание |
|-------|------|------|----------|
| POST | `/sessions` | `{ userId, scenarioId }` | Старт → `{ sessionId, presentation }` |
| GET | `/sessions/{id}` | — | Текущий узел. Если дедлайн прошёл, сначала применяется таймаут (`timedOutApplied: true`) |
| POST | `/sessions/{id}/choose` | `{ choiceId }` | Применить выбор → следующий узел или финал с разбором |
| POST | `/sessions/{id}/timeout` | — | Время вышло: применяется `timeoutChoice` узла |
| GET | `/sessions/{id}/debrief` | — | Разбор завершённой сессии |

### Профиль и геймификация

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/users` | Список демо-профилей |
| GET | `/users/{id}` | Профиль, уровень, ачивки |
| POST | `/users/{id}/reset` | Сброс прогресса из seed |
| GET | `/users/{id}/analytics` | Средние итоги, сильные компетенции и пробелы |
| GET | `/leaderboard?scope=company\|depot\|brigade&depotId=&brigadeId=` | Рейтинг |
| GET | `/achievements` | Справочник ачивок |
| GET | `/notifications/{userId}` | Уведомления |
| POST | `/notifications/{userId}/read` | Отметить прочитанными |

### Интеграции

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/integrations/hr/export/{userId}` | Пакет прогресса для HR/LMS (формат `vsm-conductor.hr.v1`) |

## Форматы

### presentation — узел для клиента

```json
{
  "nodeId": "report",
  "type": "situation",
  "title": "Сообщение пассажира",
  "text": "«Там у двери чья-то чёрная сумка…»",
  "image": "/scenes/scene-bag.jpg",
  "competencyFocus": ["безопасность"],
  "loyalty": 50,
  "safety": 50,
  "xp": 0,
  "status": "active",
  "timerSec": 20,
  "deadlineAt": 1790521060157,
  "serverNow": 1790521040158,
  "choices": [
    { "id": "secure", "text": "Не трогать вещь, попросить людей отойти…" }
  ]
}
```

До выбора клиент получает только `id` и `text` варианта. Эффекты, пояснения и оценка варианта не отдаются, это проверяется в `npm run selfcheck`. `serverNow` нужен, чтобы клиент считал оставшееся время по серверным часам.

Для финального узла `type` = `ending`, добавляются `outcome` (`success` / `partial` / `fail`) и `summary`, а `choices` пустой.

### Ответ на выбор

```json
{
  "presentation": { "...": "следующий узел" },
  "lastStep": {
    "index": 1,
    "nodeId": "report",
    "choiceText": "Не трогать вещь, попросить людей отойти, сразу сообщить НП и ПТБ",
    "timedOut": false,
    "effects": { "loyalty": 5, "safety": 20, "xp": 25 },
    "feedback": "Дистанция + оповещение ответственных служб.",
    "betterAlternative": null,
    "competencyTags": ["безопасность", "регламент"]
  },
  "completed": false
}
```

На финальном шаге `completed: true` и добавляются:

- `debrief`: `scenarioId`, `title`, `outcome`, `endingText`, `finalLoyalty`, `finalSafety`, `xpEarned`, `steps[]`, `competencies`, `tips[]`;
- `rewards`: `xpGain`, `level { level, totalXp, xpToNext, … }`, `newlyUnlocked[]` — новые ачивки;
- `user`: обновлённый профиль.

### Добавление развилки

`POST /scenarios/{id}/choices`

```json
{
  "nodeId": "boarding",
  "choice": {
    "id": "lab_option",
    "text": "Предложить пассажиру пройти в тамбур и спокойно объяснить правило ещё раз",
    "next": "resist",
    "effects": { "loyalty": 5, "safety": 5, "xp": 10 },
    "feedback": "Дополнительный сервисный вариант."
  }
}
```

Перед записью в файл граф проверяется заново. Если проверка не прошла, файл не меняется и возвращается `400` с `details`.

### Экспорт для HR/LMS

```json
{
  "format": "vsm-conductor.hr.v1",
  "exportedAt": "2026-09-27T14:57:20.254Z",
  "employeeSyntheticId": "u-anna",
  "displayName": "Анна Смирнова",
  "depotId": "depot-msk",
  "brigadeId": "brigade-7",
  "competencies": {
    "strong": [{ "name": "безопасность", "xp": 139 }],
    "weak": [{ "name": "сервис", "xp": 20 }],
    "all": { "безопасность": 139, "регламент": 127, "сервис": 20 }
  },
  "level": { "level": 2, "totalXp": 190 }
}
```

## Ошибки

Тело ошибки: `{ "error": "текст", "details"?: [...] }`.

| Код | Когда |
|-----|-------|
| 400 | Нет `choiceId`; сессия уже завершена; невалидная развилка; нужен существующий `userId` |
| 404 | Сценарий, сессия или пользователь не найдены |
| 409 | Вариант с таким `id` уже есть в узле |
| 500 | Сценарий повреждён (граф не прошёл валидацию) или внутренняя ошибка |

Неизвестный `choiceId` не считается ошибкой: он засчитывается как таймаут (`timedOut: true`), так же как пропуск ответа.

## Пример: полный проход через curl

```bash
API=http://localhost:8787/api

# 1. старт
SID=$(curl -s -X POST $API/sessions \
  -H 'content-type: application/json' \
  -d '{"userId":"u-maria","scenarioId":"unattended-bag"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).sessionId')

# 2. три решения
for c in secure perimeter hold; do
  curl -s -X POST $API/sessions/$SID/choose \
    -H 'content-type: application/json' -d "{\"choiceId\":\"$c\"}" > /dev/null
done

# 3. разбор
curl -s $API/sessions/$SID/debrief
```

Тот же сценарий автоматически проходит `npm run smoke`.
