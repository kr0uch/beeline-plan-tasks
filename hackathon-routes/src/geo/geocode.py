from __future__ import annotations
import json, time
import requests
from src.config import DATA_CACHE

CACHE_FILE = DATA_CACHE / "geocode_cache.json"

DISTRICT_CENTROIDS = {
    "Кузьминки": (55.6945, 37.7735),
    "Таганский": (55.7406, 37.6538),
    "Текстильщики": (55.7087, 37.7445),
    "Рязанский": (55.7225, 37.7625),
    "Южнопортовый": (55.7235, 37.6875),
    "Нижегородский": (55.7295, 37.7205),
    "Лефортово": (55.7575, 37.6985),
    "Выхино": (55.7235, 37.8275),
    "Басманный": (55.7625, 37.6655),
    "Орехово Борисово Южное": (55.6135, 37.7065),
    "Орехово Борисово Северное": (55.6225, 37.7005),
    "Зябликово": (55.6105, 37.7325),
    "Братеево": (55.6265, 37.7495),
    "Царицыно": (55.6155, 37.6795),
    "Бирюлево Восточное": (55.5905, 37.6905),
    "Бирюлево Западное": (55.5865, 37.6415),
    "Москворечье - Сабурово": (55.6465, 37.6775),
    "Домодедово": (55.4405, 37.7555),
    "Кашира": (54.8335, 38.1665),
    "Ступино": (54.8975, 38.0785),
    "Даниловский": (55.7085, 37.6295),
    "Донской": (55.7105, 37.6065),
    "Академический": (55.6875, 37.5655),
    "Зюзино": (55.6545, 37.5715),
    "Котловка": (55.6785, 37.5915),
    "Хамовники": (55.7355, 37.5785),
    "Замоскворечье": (55.7385, 37.6285),
    "Нагатино - Садовники": (55.6795, 37.6435),
    "Нагатинский Затон": (55.6785, 37.6625),
    "Нагорный": (55.6715, 37.6175),
    "Гагаринский": (55.6985, 37.5835),
    "GPON Даниловский": (55.7085, 37.6295),
}


def _load_cache():
    return json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}


def _save_cache(c):
    CACHE_FILE.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")


def _nominatim(addr):
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": addr, "format": "json", "limit": 1, "countrycodes": "ru"},
            headers={"User-Agent": "hackathon-ml/1.0"}, timeout=8,
        )
        if r.status_code == 200 and r.json():
            return float(r.json()[0]["lat"]), float(r.json()[0]["lon"])
    except Exception:
        pass
    return None


def geocode(address, district, use_nominatim=False):
    cache = _load_cache()
    key = address.strip()
    if key in cache:
        return tuple(cache[key])
    if use_nominatim:
        res = _nominatim(address)
        if res:
            cache[key] = res; _save_cache(cache); time.sleep(1.1); return res
    lat, lon = DISTRICT_CENTROIDS.get(district, (55.75, 37.62))
    cache[key] = (lat, lon); _save_cache(cache)
    return lat, lon


def geocode_tasks(df, use_nominatim=False):
    lats, lons = [], []
    for _, row in df.iterrows():
        lat, lon = geocode(row["address"], row["district"], use_nominatim)
        lats.append(lat); lons.append(lon)
    df = df.copy(); df["lat"] = lats; df["lon"] = lons
    return df