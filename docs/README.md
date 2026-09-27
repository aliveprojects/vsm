# Документация Проводник.400

| № | Требование | Документ | Что внутри |
|---|------------|----------|------------|
| 1 | Описание архитектуры (диаграмма компонентов / последовательности) | [architecture.md](architecture.md) | Диаграмма компонентов, 2 диаграммы последовательности, ключевые решения, модель сценария, хранение данных, безопасность |
| 2 | Инструкция по локальному запуску и развёртыванию | [deployment.md](deployment.md) | Dev-режим, проверки (health, selfcheck, smoke), прод-сборка, Docker, переменные окружения, частые проблемы |
| 3 | Описание API (Swagger / OpenAPI или Markdown) | [api.md](api.md) + [openapi.yaml](../backend/src/openapi.yaml) | Все методы, форматы запросов и ответов, коды ошибок, пример на curl. Swagger UI: `/api/docs` |
| 4 | Пользовательский сценарий (User Flow) и примеры игровых сценариев | [user-flow.md](user-flow.md) | Путь по экранам, каталог из 9 кейсов, граф ветвлений, три просчитанных прохождения, добавление развилок |
| — | Ограничения и развитие | [limitations.md](limitations.md) | Текущие ограничения прототипа и план |
| — | Презентация | [pitch/Проводник-400.pdf](pitch/Проводник-400.pdf) | 16 слайдов |

Диаграммы написаны на Mermaid: GitHub и GitLab показывают их прямо в Markdown. Те же схемы картинками лежат в [diagrams/](diagrams/):

- [01-components.png](diagrams/01-components.png) — компоненты
- [02-sequence-start.png](diagrams/02-sequence-start.png) — последовательность: старт сессии
- [03-sequence-decision.png](diagrams/03-sequence-decision.png) — последовательность: решение игрока
- [04-scenario-model.png](diagrams/04-scenario-model.png) — модель сценария
- [05-user-flow.png](diagrams/05-user-flow.png) — путь проводника по экранам
- [06-medical-graph.png](diagrams/06-medical-graph.png) — граф «Пассажиру стало плохо»
- [07-bag-graph.png](diagrams/07-bag-graph.png) — граф «Бесхозная вещь»

Быстрый старт:

```bash
npm install
npm run dev
```

Приложение откроется на http://localhost:5173, Swagger — на http://localhost:8787/api/docs.
