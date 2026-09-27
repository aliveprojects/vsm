# API Проводник.400

Базовый URL: `http://localhost:8787/api`  
Интерактивно: [Swagger UI](http://localhost:8787/api/docs) · сырой контракт: `/api/openapi.json`

## Основные методы

### Сценарии
- `GET /scenarios` — каталог
- `GET /scenarios/:id` — метаданные + результат валидации графа

### Сессии (игровой цикл)
- `POST /sessions` `{ "userId", "scenarioId" }` → `{ sessionId, presentation }`
- `GET /sessions/:id` — текущий узел (если дедлайн прошёл — авто-таймаут)
- `POST /sessions/:id/choose` `{ "choiceId" }` → новый узел или complete+debrief
- `POST /sessions/:id/timeout` — принудительный выбор по `timeoutChoice`
- `GET /sessions/:id/debrief` — разбор после завершения

### Профиль и геймификация
- `GET /users`, `GET /users/:id`
- `GET /users/:id/analytics`
- `GET /leaderboard?scope=company|depot|brigade&depotId=&brigadeId=`
- `GET /achievements`
- `GET /notifications/:userId`
- `POST /notifications/:userId/read`

### Интеграции
- `GET /integrations/hr/export/:userId` — пакет прогресса для HR/LMS

## Формат presentation (узел)

```json
{
  "nodeId": "notice",
  "type": "situation",
  "title": "...",
  "text": "...",
  "loyalty": 58,
  "safety": 65,
  "xp": 20,
  "timerSec": 25,
  "deadlineAt": 1710000000000,
  "serverNow": 1709999980000,
  "choices": [{ "id": "protocol", "text": "...", "tone": "good" }]
}
```

Клиенту до выбора не отдаются `effects` и `feedback`.

## Пример curl

```bash
curl -s http://localhost:8787/api/health
curl -s http://localhost:8787/api/scenarios | head
curl -s -X POST http://localhost:8787/api/sessions \
  -H 'content-type: application/json' \
  -d '{"userId":"u-maria","scenarioId":"pet-carrier"}'
```
