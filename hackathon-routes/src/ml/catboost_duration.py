from __future__ import annotations
from pathlib import Path
import pandas as pd
from catboost import CatBoostRegressor, Pool

from src.config import DATA_PROC, DATA_RAW, REGIONS
from src.config import DURATION_MIN, DURATION_MAX

MODEL_PATH = DATA_PROC / "duration_catboost.cbm"


def build_training_data():
    rows = []
    for region_name, cfg in REGIONS.items():
        fp = DATA_RAW / cfg.control_file
        if not fp.exists(): continue
        df = None
        for enc in ("utf-8", "cp1251", "utf-8-sig"):
            try:
                df = pd.read_csv(fp, sep=";", dtype=str, encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        if df is None:
            continue
        df = df[df["Статус BK"] == "Выполнена"].copy()

        from src.io.load_tasks import _parse_dt, _required_skills_and_equipment, _minutes_from_shift_start
        df["start_dt"] = df["Начало"].map(_parse_dt)
        df["end_dt"] = df["Окончание"].map(_parse_dt)
        df = df.dropna(subset=["start_dt", "end_dt"])
        slot = (df["end_dt"] - df["start_dt"]).dt.total_seconds() / 60.0
        df["slot_duration"] = slot.clip(DURATION_MIN, DURATION_MAX)

        sk = df.apply(_required_skills_and_equipment, axis=1)
        df["required_skills"] = sk.map(lambda t: t[0])

        for _, r in df.iterrows():
            rows.append({
                "type_bk": r["Тип заявки BK"],
                "type_hd": r["Тип заявки HD"],
                "district": r["Район"],
                "gigabit": int("gigabit" in r["required_skills"]),
                "fttb": int("fttb" in r["required_skills"]),
                "priority": "emergency" if "авар" in str(r["Тип заявки HD"]).lower()
                             else ("connection" if "подключ" in str(r["Тип заявки BK"]).lower()
                                   else ("extra" if "дозаказ" in str(r["Тип заявки BK"]).lower()
                                         else "local")),
                "target": float(r["slot_duration"]),
            })
    return pd.DataFrame(rows)


def train(save=True):
    df = build_training_data()
    if len(df) < 30:
        print(f"[catboost] мало данных ({len(df)}), пропускаем")
        return None
    print(f"[catboost] train on {len(df)} examples")

    cat_features = ["type_bk", "type_hd", "district", "priority"]
    X = df[cat_features + ["gigabit", "fttb"]]
    y = df["target"]

    model = CatBoostRegressor(
        iterations=500, depth=6, learning_rate=0.08,
        loss_function="RMSE", verbose=False, random_seed=42,
    )
    model.fit(Pool(X, y, cat_features=cat_features))

    if save:
        model.save_model(str(MODEL_PATH))
        print(f"[catboost] saved → {MODEL_PATH}")
    return model


def load_model():
    if not MODEL_PATH.exists():
        return None
    m = CatBoostRegressor()
    m.load_model(str(MODEL_PATH))
    return m


if __name__ == "__main__":
    train()