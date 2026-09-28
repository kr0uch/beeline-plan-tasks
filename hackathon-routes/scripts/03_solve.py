import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from src.config import DATA_PROC, REGIONS
from src.geo.matrix import build_matrix
from src.solver.vrp import solve_vrp
from src.solver.metrics import print_report, save_plan, save_geojson
from src.explain.reasons import explain_assignment, explain_unassigned


def main(region_name="east", time_limit=20):
    cfg = REGIONS[region_name]
    df = pd.read_csv(DATA_PROC / f"tasks_{region_name}_final.csv")
    engineers = json.loads((DATA_PROC / f"engineers_{region_name}.json").read_text(encoding="utf-8"))

    depots = []
    for e in engineers:
        key = (round(e["depot_lat"], 5), round(e["depot_lon"], 5))
        if key not in [(d[0], d[1]) for d in depots]:
            depots.append((e["depot_lat"], e["depot_lon"]))
    points = depots + list(zip(df["lat"], df["lon"]))
    time_mat, dist_mat = build_matrix(points, region_name, use_osrm=True)

    tasks = []
    for _, row in df.iterrows():
        tasks.append({
            "id": int(row["id"]), "type_bk": row["type_bk"], "type_hd": row["type_hd"],
            "district": row["district"], "address": row["address"],
            "lat": float(row["lat"]), "lon": float(row["lon"]),
            "tw_start": int(row["tw_start"]), "tw_end": int(row["tw_end"]),
            "service_time": int(row["service_time"]), "priority": row["priority"],
            "required_skills": eval(row["required_skills"]) if isinstance(row["required_skills"], str) else row["required_skills"],
            "required_equipment": eval(row["required_equipment"]) if isinstance(row["required_equipment"], str) else row["required_equipment"],
        })

    result = solve_vrp(tasks, engineers, time_mat, dist_mat, time_limit_sec=time_limit)

    eng_by_id = {e["id"]: e for e in engineers}; tsk_by_id = {t["id"]: t for t in tasks}
    for a in result.assigned:
        a["explanation"] = explain_assignment(tsk_by_id[a["task_id"]], eng_by_id[a["engineer_id"]], a)
    for u in result.unassigned:
        u["explanation"] = explain_unassigned(tsk_by_id[u["task_id"]], u["reason"])

    print_report(result)
    save_plan(result, region_name)
    save_geojson(result, tsk_by_id, eng_by_id, region_name)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", default="east")
    ap.add_argument("--limit", type=int, default=20)
    args = ap.parse_args()
    main(args.region, args.limit)