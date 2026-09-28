from __future__ import annotations
import json
from src.config import DATA_PROC


def print_report(result):
    m = result.metrics
    print("=" * 60)
    print(f"STATUS: {m.get('status')}")
    print(f"Задач всего:   {m.get('total_tasks', 0)}")
    print(f"Назначено:     {m.get('assigned', 0)} ({m.get('assigned_rate', 0)*100:.1f}%)")
    print(f"Пропущено:     {m.get('unassigned', 0)}")
    print(f"Опозданий:     {m.get('late_count', 0)} (сумма {m.get('total_late_min', 0)} мин)")
    print(f"Переработка:   {m.get('overtime_min', 0)} мин")
    print(f"Пробег:        {m.get('total_distance_km', 0)} км")
    print(f"Время в пути:  {m.get('total_travel_min', 0)} мин")
    print(f"Общее время:   {m.get('total_time_min', 0)} мин")
    print(f"Бригад занято: {m.get('engineers_used', 0)}")
    print(f"Загрузка:      mean={m.get('load_mean', 0)}, std={m.get('load_std', 0)}, "
          f"min={m.get('load_min', 0)}, max={m.get('load_max', 0)}")
    print("=" * 60)


def save_plan(result, region_name):
    fp = DATA_PROC / f"plan_{region_name}.json"
    data = {"routes": result.routes, "assigned": result.assigned,
            "unassigned": result.unassigned, "ml_metrics": result.metrics}
    fp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Plan → {fp}")


def save_geojson(result, tasks_by_id, engineers_by_id, region_name):
    feats = []
    palette = ["#e6194b","#3cb44b","#ffe119","#4363d8","#f58231","#911eb4",
               "#46f0f0","#f032e6","#bcf60c","#fabebe","#008080","#e6beff"]
    for i, r in enumerate(result.routes):
        if not r["tasks"]: continue
        eng = engineers_by_id[r["engineer_id"]]
        coords = [[eng["depot_lon"], eng["depot_lat"]]]
        for t in r["tasks"]:
            coords.append([t["lon"], t["lat"]])
        coords.append([eng["depot_lon"], eng["depot_lat"]])
        feats.append({
            "type": "Feature",
            "properties": {"engineer_id": eng["id"], "engineer_name": eng["name"],
                           "distance_km": r["distance_km"], "time_min": r["time_min"],
                           "num_tasks": len(r["tasks"]), "color": palette[i % len(palette)]},
            "geometry": {"type": "LineString", "coordinates": coords},
        })
    for t in tasks_by_id.values():
        feats.append({
            "type": "Feature",
            "properties": {"task_id": t["id"], "type_bk": t["type_bk"], "type_hd": t["type_hd"],
                           "priority": t["priority"], "address": t["address"],
                           "tw": f"{t['tw_start']//60:02d}:{t['tw_start']%60:02d}–{t['tw_end']//60:02d}:{t['tw_end']%60:02d}"},
            "geometry": {"type": "Point", "coordinates": [t["lon"], t["lat"]]},
        })
    fp = DATA_PROC / f"plan_{region_name}.geojson"
    fp.write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                             ensure_ascii=False), encoding="utf-8")
    print(f"GeoJSON → {fp}")