from __future__ import annotations
from datetime import datetime
import pandas as pd

from src.config import (
    DATA_RAW, RegionConfig, REGIONS, classify_priority,
    SKILL_BASIC, SKILL_FMC, SKILL_FTTB, SKILL_GIGABIT, SKILL_EMERGENCY,
    EQ_ROUTER, EQ_TV_BOX, EQ_CABLE_KIT, EQ_GIGABIT_KIT,
    SHIFT_START_MIN, SHIFT_END_MIN,
)


def _parse_dt(x):
    if pd.isna(x): return None
    x = str(x).strip()
    for fmt in ("%d.%m.%Y %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try: return datetime.strptime(x, fmt)
        except ValueError: continue
    return None


def _minutes_from_shift_start(dt: datetime, day_start_hour: int = 9) -> int:
    return dt.hour * 60 + dt.minute


def _required_skills_and_equipment(row: pd.Series):
    skills = [SKILL_BASIC]; equipment: list[str] = []
    type_hd = str(row.get("Тип заявки HD", "")).lower()
    type_bk = str(row.get("Тип заявки BK", "")).lower()
    conn = str(row.get("Подключение", "") or "").strip().upper()
    gigabit = str(row.get("Гигабитное подключение", "") or "").strip().lower()

    if "авар" in type_hd or "авар" in type_bk: skills.append(SKILL_EMERGENCY)
    if conn == "FMC": skills.append(SKILL_FMC)
    elif conn == "FTTB": skills.append(SKILL_FTTB)
    if gigabit == "да":
        skills.append(SKILL_GIGABIT); equipment.append(EQ_GIGABIT_KIT)
    if "роутер" in type_hd: equipment.append(EQ_ROUTER)
    if "приставк" in type_hd or "tve" in type_hd or "тв." in type_hd: equipment.append(EQ_TV_BOX)
    if "кабел" in type_hd or "разрыв" in type_hd: equipment.append(EQ_CABLE_KIT)
    return skills, equipment


def load_tasks(region: RegionConfig) -> pd.DataFrame:
    path = DATA_RAW / region.synthetic_file
    df = None
    for enc in ("utf-8", "cp1251", "utf-8-sig"):
        try:
            df = pd.read_csv(path, sep=";", dtype=str, encoding=enc)
            break
        except UnicodeDecodeError:
            continue
    if df is None:
        raise RuntimeError(f"Не удалось прочитать {path} ни в одной кодировке")
    df = df.dropna(how="all")
    df = df[~df["Заявка"].astype(str).str.lower().str.contains("адрес офиса", na=False)]
    df = df[df["Заявка"].notna() & (df["Заявка"].astype(str).str.strip() != "")].reset_index(drop=True)

    df["tw_start_dt"] = df["Начало"].map(_parse_dt)
    df["tw_end_dt"] = df["Окончание"].map(_parse_dt)
    df = df.dropna(subset=["tw_start_dt", "tw_end_dt"]).reset_index(drop=True)
    df["tw_start"] = df["tw_start_dt"].map(_minutes_from_shift_start)
    df["tw_end"] = df["tw_end_dt"].map(_minutes_from_shift_start)
    df["tw_start"] = df["tw_start"].clip(SHIFT_START_MIN, SHIFT_END_MIN)
    df["tw_end"] = df["tw_end"].clip(SHIFT_START_MIN + 30, SHIFT_END_MIN)

    wide = (df["tw_end"] - df["tw_start"]) >= 12 * 60
    df.loc[wide, "tw_start"] = SHIFT_START_MIN
    df.loc[wide, "tw_end"] = SHIFT_END_MIN

    df["priority"] = [classify_priority(b, h)
                      for b, h in zip(df["Тип заявки BK"], df["Тип заявки HD"])]
    sk_eq = df.apply(_required_skills_and_equipment, axis=1)
    df["required_skills"] = sk_eq.map(lambda t: t[0])
    df["required_equipment"] = sk_eq.map(lambda t: t[1])

    out = df[[
        "Заявка", "Тип заявки BK", "Тип заявки HD",
        "Район", "Адрес", "tw_start", "tw_end",
        "priority", "required_skills", "required_equipment",
    ]].rename(columns={
        "Заявка": "id", "Тип заявки BK": "type_bk", "Тип заявки HD": "type_hd",
        "Район": "district", "Адрес": "address",
    })
    out["id"] = out["id"].astype(int)
    return out.reset_index(drop=True)


def load_all_tasks():
    return {name: load_tasks(cfg) for name, cfg in REGIONS.items()}