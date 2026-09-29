from __future__ import annotations
import math
from dataclasses import dataclass
from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from src.config import PRIORITY_PENALTY, LATE_PENALTY, HORIZON_MIN


@dataclass
class SolveResult:
    assigned: list[dict]
    unassigned: list[dict]
    routes: list[dict]
    metrics: dict


def _allowed_vehicles(tasks, engineers):
    out = []
    for t in tasks:
        need_sk = set(t["required_skills"]); need_eq = set(t["required_equipment"])
        allowed = [v for v, e in enumerate(engineers)
                   if need_sk.issubset(set(e["skills"])) and need_eq.issubset(set(e["equipment"]))]
        out.append(allowed)
    return out


def _unique_depots(engineers):
    depots = []; idx_by_eng = []
    for e in engineers:
        key = (round(e["depot_lat"], 5), round(e["depot_lon"], 5))
        if key not in [d["key"] for d in depots]:
            depots.append({"key": key, "lat": e["depot_lat"], "lon": e["depot_lon"]})
        idx_by_eng.append([d["key"] for d in depots].index(key))
    return depots, idx_by_eng


def solve_vrp(tasks, engineers, time_matrix, dist_matrix, time_limit_sec=20,
              locked_assignments=None, current_positions=None):
    n_tasks = len(tasks)
    n_eng = len(engineers)

    depots, depot_idx_by_eng = _unique_depots(engineers)
    n_depots = len(depots)
    n_nodes = n_depots + n_tasks

    starts = [depot_idx_by_eng[v] for v in range(n_eng)]
    ends = [depot_idx_by_eng[v] for v in range(n_eng)]

    manager = pywrapcp.RoutingIndexManager(n_nodes, n_eng, starts, ends)
    routing = pywrapcp.RoutingModel(manager)

    def time_cb(fi, ti):
        f = manager.IndexToNode(fi); t = manager.IndexToNode(ti)
        service = tasks[f - n_depots]["service_time"] if f >= n_depots else 0
        return int(time_matrix[f][t] + service)

    def dist_cb(fi, ti):
        f = manager.IndexToNode(fi); t = manager.IndexToNode(ti)
        return int(dist_matrix[f][t])

    time_idx = routing.RegisterTransitCallback(time_cb)
    dist_idx = routing.RegisterTransitCallback(dist_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(time_idx)

    routing.AddDimension(time_idx, 1440, HORIZON_MIN + 1500, False, "Time")
    time_dim = routing.GetDimensionOrDie("Time")
    time_dim.SetSpanCostCoefficientForAllVehicles(1)

    for v in range(n_eng):
        s = routing.Start(v); e = routing.End(v)
        shift_start = engineers[v]["shift_start"]
        shift_end = engineers[v]["shift_end"]
        if current_positions and engineers[v]["id"] in current_positions:
            cur = current_positions[engineers[v]["id"]]
            shift_start = max(shift_start, cur.get("time_min", shift_start))
        time_dim.CumulVar(s).SetRange(shift_start, shift_start + 60)
        time_dim.CumulVar(e).SetMax(shift_end + 600)
        time_dim.SetCumulVarSoftUpperBound(e, shift_end, 1000)

    allowed = _allowed_vehicles(tasks, engineers)

    for i, t in enumerate(tasks):
        idx = manager.NodeToIndex(n_depots + i)
        time_dim.CumulVar(idx).SetMin(t["tw_start"])
        time_dim.SetCumulVarSoftUpperBound(
            idx, t["tw_end"], LATE_PENALTY.get(t["priority"], 1000)
        )

        if locked_assignments and t["id"] in locked_assignments:
            eng_id = locked_assignments[t["id"]]
            v = next(j for j, e in enumerate(engineers) if e["id"] == eng_id)
            routing.VehicleVar(idx).SetValues([v])
        elif allowed[i]:
            routing.VehicleVar(idx).SetValues(allowed[i])

        routing.AddDisjunction([idx], PRIORITY_PENALTY.get(t["priority"], 10_000))

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.guided_local_search_lambda_coefficient = 0.15
    params.time_limit.seconds = time_limit_sec
    params.log_search = False

    sol = routing.SolveWithParameters(params)
    if sol is None:
        return SolveResult(
            assigned=[],
            unassigned=[{"task_id": t["id"], "reason": "unknown"} for t in tasks],
            routes=[], metrics={"status": "NO_SOLUTION"},
        )

    assigned = []; routes_out = []; assigned_ids = set()

    for v, eng in enumerate(engineers):
        idx = routing.Start(v)
        route_pos = 0; route_tasks_full = []; task_ids = []
        total_dist_m = 0; total_travel_min = 0; total_service_min = 0
        prev_node = manager.IndexToNode(idx)

        while not routing.IsEnd(idx):
            node = manager.IndexToNode(idx)
            if node >= n_depots:
                t = tasks[node - n_depots]
                arrival = sol.Min(time_dim.CumulVar(idx))
                end = arrival + t["service_time"]
                assigned.append({
                    "task_id": t["id"], "engineer_id": eng["id"],
                    "engineer_name": eng["name"],
                    "arrival_min": int(arrival), "start_min": int(arrival), "end_min": int(end),
                    "tw_start": t["tw_start"], "tw_end": t["tw_end"],
                    "priority": t["priority"], "position_in_route": route_pos,
                    "late_min": max(0, int(arrival) - t["tw_end"]),
                })
                route_tasks_full.append({
                    "task_id": t["id"], "type_bk": t["type_bk"], "type_hd": t["type_hd"],
                    "district": t["district"], "address": t["address"],
                    "lat": t["lat"], "lon": t["lon"],
                    "tw_start": t["tw_start"], "tw_end": t["tw_end"],
                    "service_time": t["service_time"], "priority": t["priority"],
                    "required_skills": t["required_skills"],
                    "required_equipment": t["required_equipment"],
                })
                task_ids.append(t["id"])
                assigned_ids.add(t["id"])
                total_dist_m += int(dist_matrix[prev_node][node])
                total_travel_min += int(time_matrix[prev_node][node])
                total_service_min += int(t["service_time"])
                route_pos += 1; prev_node = node
            idx = sol.Value(routing.NextVar(idx))

        final_node = manager.IndexToNode(idx)
        total_dist_m += int(dist_matrix[prev_node][final_node])
        total_travel_min += int(time_matrix[prev_node][final_node])

        routes_out.append({
            "engineer_id": eng["id"], "engineer_name": eng["name"],
            "transport": eng["transport"],
            "distance_km": round(total_dist_m / 1000.0, 2),
            "time_min": int(total_travel_min + total_service_min),
            "travel_time_min": int(total_travel_min),
            "service_time_min": int(total_service_min),
            "tasks": route_tasks_full,
        })

    unassigned = []
    for t in tasks:
        if t["id"] not in assigned_ids:
            need_sk = set(t["required_skills"]); need_eq = set(t["required_equipment"])
            if not any(need_sk.issubset(set(e["skills"])) and
                       need_eq.issubset(set(e["equipment"])) for e in engineers):
                reason = "no_engineer_with_required_skills"
            elif t["tw_end"] - t["tw_start"] < 30:
                reason = "time_window_conflict"
            elif t["priority"] == "extra":
                reason = "overload"
            else:
                reason = "time_window_conflict"
            unassigned.append({"task_id": t["id"], "reason": reason})

    metrics = _compute_metrics(assigned, unassigned, tasks, engineers, routes_out)
    return SolveResult(assigned=assigned, unassigned=unassigned, routes=routes_out, metrics=metrics)


def _compute_metrics(assigned, unassigned, tasks, engineers, routes_out):
    total = len(tasks); n_assigned = len(assigned)
    late = sum(1 for a in assigned if a["late_min"] > 0)
    total_late = sum(a["late_min"] for a in assigned)
    overtime = 0
    for r in routes_out:
        eng = next(e for e in engineers if e["id"] == r["engineer_id"])
        if not r["tasks"]: continue
        last_end = max(a["end_min"] for a in assigned if a["engineer_id"] == r["engineer_id"])
        if last_end > eng["shift_end"]:
            overtime += last_end - eng["shift_end"]
    loads = [len(r["tasks"]) for r in routes_out]
    mean_load = sum(loads) / len(loads) if loads else 0
    std_load = math.sqrt(sum((x - mean_load)**2 for x in loads)/len(loads)) if loads else 0
    total_dist_km = sum(r["distance_km"] for r in routes_out)
    total_time_min = sum(r["time_min"] for r in routes_out)
    total_travel_min = sum(r["travel_time_min"] for r in routes_out)
    return {
        "status": "OK", "total_tasks": total,
        "assigned": n_assigned, "unassigned": len(unassigned),
        "assigned_rate": round(n_assigned/total, 4) if total else 0,
        "engineers_used": sum(1 for r in routes_out if r["tasks"]),
        "total_distance_km": round(total_dist_km, 2),
        "total_time_min": int(total_time_min),
        "total_travel_min": int(total_travel_min),
        "late_count": late, "total_late_min": int(total_late),
        "overtime_min": int(overtime),
        "load_mean": round(mean_load, 2), "load_std": round(std_load, 2),
        "load_max": max(loads) if loads else 0, "load_min": min(loads) if loads else 0,
    }