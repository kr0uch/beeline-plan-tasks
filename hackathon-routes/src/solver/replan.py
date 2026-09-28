from __future__ import annotations
from src.config import DATA_PROC, REGIONS
from src.geo.matrix import build_matrix
from src.geo.geocode import geocode
from src.ml.duration import predict_duration
from src.solver.vrp import solve_vrp
import hashlib

def replan(region_name, new_task, current_state, pending_tasks, locked_tasks,
           engineers, time_limit_sec=15):
    cfg = REGIONS[region_name]

    if new_task.get("lat") is None or new_task.get("lon") is None:
        new_task["lat"], new_task["lon"] = geocode(new_task["address"], new_task["district"])
    if not new_task.get("service_time"):
        new_task["service_time"] = predict_duration(new_task)

    all_tasks = list(pending_tasks) + [new_task]
    task_ids = {t["id"] for t in all_tasks}

    depots = []
    for e in engineers:
        key = (round(e["depot_lat"], 5), round(e["depot_lon"], 5))
        if key not in [(d[0], d[1]) for d in depots]:
            depots.append((e["depot_lat"], e["depot_lon"]))

    current_points = [(s["lat"], s["lon"]) for s in current_state.values()]
    points = depots + current_points + [(t["lat"], t["lon"]) for t in all_tasks]

    fp = hashlib.md5(
        str([(round(p[0], 4), round(p[1], 4)) for p in points]).encode()
    ).hexdigest()[:10]
    region_key = f"replan_{region_name}_{fp}"
    time_mat, dist_mat = build_matrix(points, region_key, use_osrm=True)

    result = solve_vrp(
        all_tasks, engineers, time_mat, dist_mat,
        time_limit_sec=time_limit_sec,
        locked_assignments={lid: None for lid in locked_tasks} or None,
        current_positions=current_state,
    )
    return result