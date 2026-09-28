from __future__ import annotations
from src.config import (
    DURATION_PRIORS, DURATION_GIGABIT_BONUS, DURATION_FTTB_BONUS,
    DURATION_MIN, DURATION_MAX, SKILL_GIGABIT, SKILL_FTTB,
)

_CATBOOST_MODEL = None
_CATBOOST_LOADED = False


def _try_load_catboost():
    global _CATBOOST_MODEL, _CATBOOST_LOADED
    if _CATBOOST_LOADED:
        return _CATBOOST_MODEL
    _CATBOOST_LOADED = True
    try:
        from src.ml.catboost_duration import load_model
        _CATBOOST_MODEL = load_model()
    except Exception:
        _CATBOOST_MODEL = None
    return _CATBOOST_MODEL


def _base_bk(t):
    for k, v in DURATION_PRIORS.items():
        if k.lower() in (t or "").lower(): return v
    return 60


def _mod_hd(t):
    if t in DURATION_PRIORS: return DURATION_PRIORS[t]
    for k, v in DURATION_PRIORS.items():
        if k.lower() in (t or "").lower(): return v
    return 0


def predict_duration(task: dict, engineer: dict | None = None) -> int:
    model = _try_load_catboost()
    if model is not None:
        try:
            import pandas as pd
            X = pd.DataFrame([{
                "type_bk": task.get("type_bk", ""),
                "type_hd": task.get("type_hd", ""),
                "district": task.get("district", ""),
                "gigabit": int("gigabit" in (task.get("required_skills") or [])),
                "fttb": int("fttb" in (task.get("required_skills") or [])),
                "priority": task.get("priority", "local"),
            }])
            pred = model.predict(X)[0]
            return int(max(DURATION_MIN, min(DURATION_MAX, round(float(pred)))))
        except Exception:
            pass

    base = _base_bk(task.get("type_bk", ""))
    mod = _mod_hd(task.get("type_hd", ""))
    req = task.get("required_skills") or []
    if SKILL_GIGABIT in req: mod += DURATION_GIGABIT_BONUS
    if SKILL_FTTB in req: mod += DURATION_FTTB_BONUS
    return int(max(DURATION_MIN, min(DURATION_MAX, base + mod)))


def add_durations_to_tasks(tasks_df, engineers):
    tasks_df = tasks_df.copy()
    tasks_df["service_time"] = [predict_duration(r.to_dict()) for _, r in tasks_df.iterrows()]
    return tasks_df