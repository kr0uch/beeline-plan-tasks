from __future__ import annotations
import math
import numpy as np
import requests
from src.config import DATA_CACHE

OSRM_BASE = "http://localhost:5000"
ROAD_FACTOR = 1.35
SPEED_CITY_KMH = 25.0
SPEED_OUTSKIRTS_KMH = 40.0


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1); dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))


def _speed(lat1, lon1, lat2, lon2):
    def in_mkad(la, lo): return 55.55 <= la <= 55.93 and 37.33 <= lo <= 37.90
    return SPEED_CITY_KMH if (in_mkad(lat1, lon1) and in_mkad(lat2, lon2)) else SPEED_OUTSKIRTS_KMH


def haversine_matrix(points):
    n = len(points)
    t = np.zeros((n, n), dtype=np.int32); d = np.zeros((n, n), dtype=np.int32)
    for i in range(n):
        for j in range(n):
            if i == j: continue
            km = _haversine_km(*points[i], *points[j]) * ROAD_FACTOR
            t[i, j] = max(1, int(round(km / _speed(*points[i], *points[j]) * 60)))
            d[i, j] = int(round(km * 1000))
    return t, d


def osrm_matrix(points):
    coords = ";".join(f"{lon},{lat}" for lat, lon in points)
    url = f"{OSRM_BASE}/table/v1/driving/{coords}"
    r = requests.get(url, params={"annotations": "duration,distance"}, timeout=60)
    r.raise_for_status()
    data = r.json()
    durations = np.array(data["durations"], dtype=float)
    distances = np.array(data["distances"], dtype=float)
    t = np.ceil(durations / 60.0).astype(np.int32)
    d = distances.astype(np.int32)
    np.fill_diagonal(t, 0); np.fill_diagonal(d, 0)
    return t, d


def build_matrix(points, region_name: str, use_osrm=True, force=False):
    cache = DATA_CACHE / f"matrix_{region_name}.npz"
    if cache.exists() and not force:
        d = np.load(cache); return d["time"], d["dist"]
    if use_osrm:
        try:
            requests.get(f"{OSRM_BASE}/route/v1/driving/37.6,55.7;37.7,55.7", timeout=3)
            t, d = osrm_matrix(points)
            print(f"[matrix] OSRM OK ({len(points)}×{len(points)})")
        except Exception as e:
            print(f"[matrix] OSRM недоступен ({e}), fallback Haversine")
            t, d = haversine_matrix(points)
    else:
        t, d = haversine_matrix(points)
        print(f"[matrix] Haversine ({len(points)}×{len(points)})")
    np.savez_compressed(cache, time=t, dist=d)
    return t, d