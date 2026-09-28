# МаршрутПро — веб-интерфейс

React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router, архитектура Feature-Sliced Design.

```bash
npm install
npm run dev      # http://localhost:5173, /api проксируется на http://localhost:8080
npm run build
```

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Базовый URL API |
| `VITE_PLAN_TIME_ORIGIN_MIN` | `0` | Точка отсчёта `*_min` полей в минутах от полуночи (`480`, если бэкенд считает от 08:00) |

## Структура (FSD)

```
src/
  app/        точка входа, роутер, layout, глобальные стили и токены дизайна
  pages/      planning — экран планирования; placeholder — заглушки разделов
  widgets/    app-sidebar, app-header, plan-alert, plan-kpi, crew-list, route-map, task-inspector, gantt-timeline
  features/   load-plan — состояние плана, загрузка CSV (POST /plan), демо-данные, пересчёт
  entities/   plan — DTO из swagger, API, view-модель; task — тип и приоритет заявки
  shared/     api, config, lib, ui
```

Без бэкенда: на стартовом экране кнопка «Демо-данные».
