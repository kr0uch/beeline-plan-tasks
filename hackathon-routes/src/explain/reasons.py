from __future__ import annotations
from src.config import REASON_HUMAN


def explain_assignment(task, engineer, assignment):
    parts = []
    spec = set(task["required_skills"]) - {"basic", "emergency"}
    if spec:
        parts.append(f"совпали спец.навыки: {', '.join(sorted(spec))}")
    else:
        parts.append("базовая квалификация подходит")
    if task["required_equipment"]:
        parts.append(f"есть оборудование: {', '.join(sorted(task['required_equipment']))}")
    if assignment["late_min"] == 0:
        parts.append("попадает в окно SLA")
    else:
        parts.append(f"опоздание {assignment['late_min']} мин — компромисс оптимизации")
    return "; ".join(parts)


def explain_unassigned(task, reason):
    return REASON_HUMAN.get(reason, REASON_HUMAN["unknown"])