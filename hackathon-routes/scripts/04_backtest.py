import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from src.config import DATA_RAW, REGIONS, classify_priority, SHIFT_START_MIN, SHIFT_END_MIN
from src.io.load_tasks import _parse_dt, _minutes_from_shift_start, _required_skills_and_equipment
from src.io.load_engineers import build_engineers
from src.geo.geocode import geocode_tasks
from src.ml.duration import add_durations_to_tasks
from src.geo.matrix import build_matrix
from src.solver.vrp import solve_vrp
from src.solver.metrics import print_report


def build_from_control(region_name):
    cfg = REGIONS[region_name]
    df = None
    for enc in ("utf-8", "cp1251", "utf-8-sig"):
        try:
            df = pd.read_csv(DATA_RAW / cfg.control_file, sep=";", dtype=str, encoding=enc)
            break
        except UnicodeDecodeError:
            continue
    if df is None:
        raise RuntimeError(f"Не удалось прочитать {cfg.control_file}")
    df = df[df["Статус BK"].isin(["Отправлена", "В пути", "В работе"])].copy()
    df = df.dropna(subset=["Заявка"]).reset_index(drop=True)

    df["tw_start_dt"] = df["Начало"].map(_parse_dt)
    df["tw_end_dt"] = df["Окончание"].map(_parse_dt)
    df = df.dropna(subset=["tw_start_dt", "tw_end_dt"]).reset_index(drop=True)
    df["tw_start"] = df["tw_start_dt"].map(_minutes_from_shift_start).clip(SHIFT_START_MIN, SHIFT_END_MIN)
    df["tw_end"] = df["tw_end_dt"].map(_minutes_from_shift_start).clip(SHIFT_START_MIN + 30, SHIFT_END_MIN)
    df["priority"] = [classify_priority(b, h) for b, h in zip(df["Тип заявки BK"], df["Тип заявки HD"])]

    sk = df.apply(_required_skills_and_equipment, axis=1)
    df["required_skills"] = sk.map(lambda t: t[0])
    df["required_equipment"] = sk.map(lambda t: t[1])

    df = df.rename(columns={"Заявка": "id", "Тип заявки BK": "type_bk",
                            "Тип заявки HD": "type_hd", "Район": "district", "Адрес": "address"})
    df["id"] = df["id"].astype(int)
    return df


def main(region_name="east"):
    cfg = REGIONS[region_name]
    tasks = build_from_control(region_name)
    print(f"[backtest {region_name}] Активных задач: {len(tasks)}")

    tasks = geocode_tasks(tasks, use_nominatim=False)
    engineers = build_engineers(cfg)
    tasks = add_durations_to_tasks(tasks, engineers)

    depots = []
    for e in engineers:
        key = (round(e["depot_lat"], 5), round(e["depot_lon"], 5))
        if key not in [(d[0], d[1]) for d in depots]:
            depots.append((e["depot_lat"], e["depot_lon"]))
    points = depots + list(zip(tasks["lat"], tasks["lon"]))
    time_mat, dist_mat = build_matrix(points, f"{region_name}_backtest", use_osrm=True)

    task_dicts = [{
        "id": int(r["id"]), "type_bk": r["type_bk"], "type_hd": r["type_hd"],
        "district": r["district"], "address": r["address"],
        "lat": float(r["lat"]), "lon": float(r["lon"]),
        "tw_start": int(r["tw_start"]), "tw_end": int(r["tw_end"]),
        "service_time": int(r["service_time"]), "priority": r["priority"],
        "required_skills": r["required_skills"], "required_equipment": r["required_equipment"],
    } for _, r in tasks.iterrows()]

    result = solve_vrp(task_dicts, engineers, time_mat, dist_mat, time_limit_sec=20)
    print_report(result)


if __name__ == "__main__":
    main()