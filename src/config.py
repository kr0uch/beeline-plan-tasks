from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT / "data" / "raw"
DATA_CACHE = ROOT / "data" / "cache"
DATA_PROC = ROOT / "data" / "processed"
for p in (DATA_CACHE, DATA_PROC):
    p.mkdir(parents=True, exist_ok=True)


@dataclass
class RegionConfig:
    name: str
    synthetic_file: str
    control_file: str
    depot_address: str
    depot_lat: float
    depot_lon: float


REGIONS = {
    "vostok": RegionConfig(
        name="vostok",
        synthetic_file="vostok_synthetic.csv",
        control_file="vostok_control.csv",
        depot_address="г. Москва, ул Юных Ленинцев, д 83с 4",
        depot_lat=55.6963, depot_lon=37.7577,
    ),
    "southeast": RegionConfig(
        name="southeast",
        synthetic_file="southeast_synthetic.csv",
        control_file="southeast_control.csv",
        depot_address="г. Москва, ул Бирюлёвская, д 1с1",
        depot_lat=55.5876, depot_lon=37.6572,
    ),
    "southcenter": RegionConfig(
        name="southcenter",
        synthetic_file="southcenter_synthetic.csv",
        control_file="southcenter_control.csv",
        depot_address="г. Москва, проезд Симферопольский, д.7",
        depot_lat=55.6530, depot_lon=37.6050,
    ),
}


SUBURBAN_DEPOTS = {
    "kashira":    {"address": "Кашира",   "lat": 54.8335, "lon": 38.1665},
    "stupino":    {"address": "Ступино",  "lat": 54.8975, "lon": 38.0785},
    "domodedovo": {"address": "Домодедово","lat": 55.4405, "lon": 37.7555},
}


SHIFT_START_MIN = 9 * 60
SHIFT_END_MIN = 22 * 60
HORIZON_MIN = SHIFT_END_MIN - SHIFT_START_MIN


PRIORITY_PENALTY = {
    "emergency": 100_000,
    "connection": 500,
    "local": 100,
    "extra": 50,
}

LATE_PENALTY = {
    "emergency": 30_000_000,
    "connection": 3_000_000,
    "local": 600_000,
    "extra": 300_000,
}

REASON_HUMAN = {
    "no_engineer_with_required_skills": "нет инженера с нужной квалификацией или оборудованием",
    "time_window_conflict": "не влезает в окно SLA ни в один маршрут",
    "overload": "все бригады загружены более приоритетными заявками",
    "too_far": "слишком далеко от доступных маршрутов",
    "unknown": "не удалось назначить (причина не классифицирована)",
}

"""
Приоритет заявки.

ВК = Beekeeper (внутренняя система), HD = HelpDesk (внешняя).
Это разные системы с разными классификаторами одной и той же заявки.
Мы используем оба поля только для определения приоритета и типа работы,
не пытаясь маппить их друг в друга.
"""
def classify_priority(type_bk: str, type_hd: str) -> str:
    tb = (type_bk or "").lower()
    th = (type_hd or "").lower()
    if "авар" in th or "авар" in tb: return "emergency"
    if "подключ" in tb: return "connection"
    if "локальн" in tb or "ремонт" in tb: return "local"
    if "дозаказ" in tb: return "extra"
    if "глобальн" in tb: return "local"
    return "local"


SKILL_BASIC = "basic"
SKILL_FMC = "fmc"
SKILL_FTTB = "fttb"
SKILL_GIGABIT = "gigabit"
SKILL_EMERGENCY = "emergency"

EQ_ROUTER = "router"
EQ_TV_BOX = "tv_box"
EQ_CABLE_KIT = "cable_kit"
EQ_OPTICS_KIT = "optics_kit"
EQ_GIGABIT_KIT = "gigabit_kit"


DURATION_PRIORS = {
    "Подключение": 60, "Дозаказ": 45, "Локальная заявка": 30, "Глобальная проблема": 60,
    "Конвергенция абонента": 0, "Заявка на подключение": -10,
    "Заказ подключения/Дозаказ оборудования": 15, "Дозаказ оборудования": 0,
    "Нет линка": 0, "Разрывы": 10, "Работа с кабелем": 20,
    "Роутер. Замена техническим специалистом": 15,
    "TVE/ENT. Другие ошибки": 10, "TVE/ENT. Замена приставки техником": 10,
    "ТВ. Замена приставки техником": 10, "Переключение на Гбит/с": 20,
    "IP-адрес 169...": 10, "Рост ошибок на порту": 10, "Низкая скорость": 10,
    "Мониторинг": -10, "Информация": -20, "Авария": 40,
}
DURATION_GIGABIT_BONUS = 30
DURATION_FTTB_BONUS = 15
DURATION_MIN = 25
DURATION_MAX = 180