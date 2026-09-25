from __future__ import annotations
import json
from src.config import (
    DATA_PROC, RegionConfig, REGIONS, SUBURBAN_DEPOTS,
    SHIFT_START_MIN, SHIFT_END_MIN,
    SKILL_BASIC, SKILL_FMC, SKILL_FTTB, SKILL_GIGABIT, SKILL_EMERGENCY,
    EQ_ROUTER, EQ_TV_BOX, EQ_CABLE_KIT, EQ_OPTICS_KIT, EQ_GIGABIT_KIT,
)


def _default_equipment():
    return [EQ_ROUTER, EQ_TV_BOX, EQ_CABLE_KIT, EQ_OPTICS_KIT]


def build_engineers(region: RegionConfig) -> list[dict]:
    base_skills = [SKILL_BASIC, SKILL_EMERGENCY]
    base_eq = _default_equipment()

    if region.name == "vostok":
        names = ["Соколов", "Мельников", "Матвеев", "Попов",
                 "Арташкин", "Комарь", "Каушнян", "Зверев",
                 "Перов", "Белузин", "Гусаковский", "Свеженцев"]
        fmc_set = {"Соколов", "Мельников", "Матвеев", "Попов",
                   "Арташкин", "Комарь", "Каушнян", "Зверев", "Перов"}
        fttb_set = {"Попов", "Перов"}
        gig_set = {"Мельников", "Попов", "Каушнян"}
        depot_map = {}
    elif region.name == "southeast":
        names = ["Паршин", "Андреев", "Белоновский", "Рыбин",
                 "Горбанев", "Бузань", "Козырь", "Саламатин",
                 "Макаров", "Каушнян", "Царьков", "Демин"]
        fmc_set = set(names) - {"Царьков", "Демин"}
        fttb_set = {"Макаров"}
        gig_set = {"Рыбин", "Белоновский"}
        depot_map = {"Саламатин": "kashira", "Козырь": "stupino", "Паршин": "domodedovo"}
    else:
        names = ["Капитанчук Александр", "Исхаков Денис", "Брюзгин Ярослав",
                 "Бахарев Андрей", "Прокопенко Вячеслав", "Выговский Сергей",
                 "Переладов Алексей", "Сакур Тимофей", "Рыбалкин Егор",
                 "Ионов Геннадий", "Данилов Даниил", "Свеженцев"]
        fmc_set = set(names) - {"Данилов Даниил", "Свеженцев"}
        fttb_set = {"Исхаков Денис"}
        gig_set = {"Брюзгин Ярослав", "Исхаков Денис"}
        depot_map = {}

    engineers = []
    for i, name in enumerate(names):
        skills = list(base_skills)
        if name in fmc_set: skills.append(SKILL_FMC)
        if name in fttb_set: skills.append(SKILL_FTTB)
        if name in gig_set: skills.append(SKILL_GIGABIT)

        equipment = list(base_eq)
        if name in gig_set: equipment.append(EQ_GIGABIT_KIT)

        if name in depot_map:
            d = SUBURBAN_DEPOTS[depot_map[name]]
            depot_lat, depot_lon, depot_addr = d["lat"], d["lon"], d["address"]
        else:
            depot_lat, depot_lon, depot_addr = (
                region.depot_lat, region.depot_lon, region.depot_address
            )

        engineers.append({
            "id": f"eng_{i:02d}",
            "name": name,
            "skills": skills,
            "equipment": equipment,
            "transport": "car",
            "shift_start": SHIFT_START_MIN,
            "shift_end": SHIFT_END_MIN,
            "depot_lat": depot_lat,
            "depot_lon": depot_lon,
            "depot_address": depot_addr,
        })
    return engineers


def save_engineers():
    for name, cfg in REGIONS.items():
        eng = build_engineers(cfg)
        fp = DATA_PROC / f"engineers_{name}.json"
        fp.write_text(json.dumps(eng, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{name}: {len(eng)} инженеров → {fp}")