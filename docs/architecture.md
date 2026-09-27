# Архитектура

## Компоненты

```
React UI  ←→  Express API (/api)
                 ├─ scenarioEngine
                 ├─ gamification
                 └─ JSON store (scenarios, users, sessions)
                        └─ HR export stub
```

## Прохождение сценария

1. `POST /sessions` — старт, выдача текущего узла
2. `POST /sessions/:id/choose` или timeout — применение эффектов и переход
3. При ending — debrief, XP, ачивки, запись прогона

## Модули backend

| Файл | Назначение |
|------|------------|
| `engine/scenarioEngine.js` | Граф узлов, таймер, ветвление, debrief |
| `engine/gamification.js` | XP, уровни, ачивки, рейтинг |
| `store/db.js` | Чтение сценариев и запись runtime |
| `routes/api.js` | HTTP API |
| `openapi.yaml` | Контракт API |

Данные сценариев лежат в файлах, чтобы их можно было править без пересборки ядра. При росте нагрузки `store/db.js` можно заменить на БД, не трогая роуты.

## Безопасность демо

В сидах только вымышленные сотрудники. Секреты в репозиторий не кладутся.
