# hackathon-routes

интеллектуальный сервис планирования маршрутов выездных инженеров. vrptw с приоритетами, soft time windows, мультидепо, replan и llm-дайджест.

## что умеет

- распределяет заявки между инженерами по навыкам и оборудованию
- учитывает временные окна и sla
- минимизирует время в пути и опоздания
- поддерживает несколько депо (москва + подмосковье)
- пересчитывает день при поступлении новой заявки с фиксацией начатых
- показывает причины выбора маршрута
- отдаёт geojson для карты

## стек

- python 3.11+
- ortools (vrptw solver)
- osrm локально (матрица времени/расстояний), fallback на haversine
- catboost (оценка длительности работ), fallback на priors
- fastapi + uvicorn
- leaflet (карта)

## установка

```bash
python -m venv .venv
.venv\Scripts\activate          # windows
pip install -r requirements.txt
```
osrm (опционально)
если поднят — матрица считается по реальным дорогам. если нет — haversine с коэффициентом 1.35.

```bash
cd docker
docker compose up -d
первый запуск требует подготовки дампа osm (см. docker/).
```
запуск
```bash
# 1. подготовка данных (задачи + инженеры + геокодинг + duration)
python scripts/01_prepare_data.py

# 2. (опционально) обучение catboost на slot_duration
python scripts/02_train_duration.py

# 3. решение vrptw
python scripts/03_solve.py --region vostok --limit 60

# 4. backtest на контрольной выборке
python scripts/04_backtest.py

# 5. api + карта
uvicorn src.api.app:app --reload
# http://localhost:8000/map/vostok
```
api
endpoint	метод	что делает
/health	get	healthcheck
/plan	post	первичное планирование
/plan/{region}	get	сохранённый план
/replan	post	пересчёт с lock и текущими позициями
/map/{region}	get	html с картой leaflet
формат запроса /plan
```json
{
  "region": "vostok",
  "tasks": [
    {
      "id": 74198,
      "type_bk": "подключение",
      "type_hd": "конвергенция абонента",
      "district": "кузьминки",
      "address": "город москва, пр-кт.волгоградский, д. 128 к 5",
      "lat": 55.6945,
      "lon": 37.7735,
      "tw_start": 660,
      "tw_end": 780,
      "service_time": 90,
      "priority": "connection",
      "required_skills": ["basic", "fmc"],
      "required_equipment": []
    }
  ],
  "engineers": [
    {
      "id": "eng_00",
      "name": "соколов",
      "skills": ["basic", "emergency", "fmc"],
      "equipment": ["router", "tv_box", "cable_kit"],
      "transport": "car",
      "shift_start": 540,
      "shift_end": 1320,
      "depot_lat": 55.6963,
      "depot_lon": 37.7577
    }
  ]
}
```
обязательно у задач: id, type_bk, type_hd, district, address, tw_start, tw_end.
опционально: lat, lon, service_time, priority, required_skills, required_equipment.
время — int-минуты от 09:00 (09:00 = 540).

структура
```text
src/
  config.py          конфиг: регионы, приоритеты, штрафы, priors
  io/                парсинг csv
  geo/               геокодинг + матрица
  ml/                оценка длительности
  solver/            vrptw + replan + метрики
  explain/           объяснения + llm-дайджест
  api/               fastapi
scripts/             пайплайн
data/raw/            исходные csv
data/processed/      готовые планы
docker/              osrm
```
метрики
assigned_rate — доля назначенных

late_count / total_late_min — опоздания

overtime_min — работа после 22:00

load_mean / std / max / min — загрузка инженеров

total_distance_km / total_time_min / total_travel_min
