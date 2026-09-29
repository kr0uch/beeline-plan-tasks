from __future__ import annotations
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
import hashlib
from src.config import DATA_PROC, REGIONS, classify_priority
from src.api.schemas import PlanRequest, ReplanRequest, PlanResponse
from src.geo.geocode import geocode
from src.geo.matrix import build_matrix
from src.ml.duration import predict_duration
from src.solver.vrp import solve_vrp
from src.solver.replan import replan as replan_fn
from src.explain.reasons import explain_assignment, explain_unassigned

app = FastAPI(title="Route Planner", version="2.0.0")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/plan/{region}")
def get_plan(region: str):
    fp = DATA_PROC / f"plan_{region}.json"
    if not fp.exists():
        raise HTTPException(404, f"Plan for {region} not found")
    return JSONResponse(json.loads(fp.read_text(encoding="utf-8")))


def _prepare_tasks(raw_tasks):
    out = []
    for t in raw_tasks:
        d = t.model_dump() if hasattr(t, "model_dump") else dict(t)
        if d.get("lat") is None or d.get("lon") is None:
            d["lat"], d["lon"] = geocode(d["address"], d["district"])
        if d.get("service_time") is None:
            d["service_time"] = predict_duration(d)
        if d.get("priority") is None:
            d["priority"] = classify_priority(d["type_bk"], d["type_hd"])
        if d.get("required_skills") is None: d["required_skills"] = ["basic"]
        if d.get("required_equipment") is None: d["required_equipment"] = []
        out.append(d)
    return out


def _attach_explanations(result, tasks, engineers):
    eng_by_id = {e["id"]: e for e in engineers}
    tsk_by_id = {t["id"]: t for t in tasks}
    for a in result.assigned:
        a["explanation"] = explain_assignment(tsk_by_id[a["task_id"]],
                                              eng_by_id[a["engineer_id"]], a)
    for u in result.unassigned:
        u["explanation"] = explain_unassigned(tsk_by_id[u["task_id"]], u["reason"])


def _solve_and_respond(tasks, engineers, region_key, time_limit):
    depots = []
    for e in engineers:
        key = (round(e["depot_lat"], 5), round(e["depot_lon"], 5))
        if key not in [(d[0], d[1]) for d in depots]:
            depots.append((e["depot_lat"], e["depot_lon"]))
    points = depots + [(t["lat"], t["lon"]) for t in tasks]
    fp = hashlib.md5(
        str([(round(p[0], 4), round(p[1], 4)) for p in points]).encode()
    ).hexdigest()[:10]
    unique_key = f"{region_key}_{fp}"
    time_mat, dist_mat = build_matrix(points, unique_key, use_osrm=True)
    result = solve_vrp(tasks, engineers, time_mat, dist_mat, time_limit_sec=time_limit)

    # Если solver не нашёл решение — возвращаем корректный ответ с нулями
    if result.metrics.get("status") == "NO_SOLUTION":
        empty_metrics = {
            "status": "NO_SOLUTION",
            "total_tasks": len(tasks),
            "assigned": 0,
            "unassigned": len(tasks),
            "assigned_rate": 0.0,
            "engineers_used": 0,
            "total_distance_km": 0.0,
            "total_time_min": 0,
            "total_travel_min": 0,
            "late_count": 0,
            "total_late_min": 0,
            "overtime_min": 0,
            "load_mean": 0.0,
            "load_std": 0.0,
            "load_max": 0,
            "load_min": 0,
        }
        return PlanResponse(
            routes=[], assigned=[],
            unassigned=[{"task_id": t["id"], "reason": "no_solution",
                         "explanation": "solver не нашёл решение"} for t in tasks],
            ml_metrics=empty_metrics,
        )

    _attach_explanations(result, tasks, engineers)
    return PlanResponse(
        routes=result.routes, assigned=result.assigned,
        unassigned=result.unassigned, ml_metrics=result.metrics,
    )


@app.post("/plan", response_model=PlanResponse)
def post_plan(req: PlanRequest):
    tasks = _prepare_tasks(req.tasks)
    engineers = [e.model_dump() for e in req.engineers]
    limit = (req.options or {}).get("time_limit_sec", 20)
    return _solve_and_respond(tasks, engineers, f"api_{req.region}", limit)


@app.post("/replan", response_model=PlanResponse)
def post_replan(req: ReplanRequest):
    engineers = [e.model_dump() for e in req.engineers]
    new_task = _prepare_tasks([req.new_task])[0]
    pending = _prepare_tasks(req.pending_tasks)

    result = replan_fn(
        region_name=req.region,
        new_task=new_task,
        current_state=req.current_state,
        pending_tasks=pending,
        locked_tasks=req.locked_task_ids,
        engineers=engineers,
        time_limit_sec=(req.options or {}).get("time_limit_sec", 15),
    )
    all_tasks = pending + [new_task]
    _attach_explanations(result, all_tasks, engineers)
    return PlanResponse(
        routes=result.routes, assigned=result.assigned,
        unassigned=result.unassigned, ml_metrics=result.metrics,
    )


@app.get("/map/{region}", response_class=HTMLResponse)
def map_view(region: str):
    fp = DATA_PROC / f"plan_{region}.geojson"
    if not fp.exists():
        raise HTTPException(404, f"GeoJSON for {region} not found")
    return HTMLResponse(_map_html(region, fp.read_text(encoding="utf-8")))


def _map_html(region, geojson):
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{region}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{{height:100%;margin:0}}</style></head>
<body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const data = {geojson};
const map = L.map('map').setView([55.72,37.7],11);
L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png',
  {{maxZoom:19,attribution:'OSM'}}).addTo(map);
L.geoJSON(data,{{filter:f=>f.geometry.type==='LineString',
  style:f=>({{color:f.properties.color,weight:4,opacity:0.85}}),
  onEachFeature:(f,l)=>l.bindPopup(
    `<b>${{f.properties.engineer_name}}</b><br>Задач: ${{f.properties.num_tasks}}<br>`+
    `Пробег: ${{f.properties.distance_km}} км<br>Время: ${{f.properties.time_min}} мин`)
}}).addTo(map);
L.geoJSON(data,{{filter:f=>f.geometry.type==='Point',
  pointToLayer:(f,ll)=>L.circleMarker(ll,{{radius:6,fillColor:'#333',color:'#fff',weight:1}}),
  onEachFeature:(f,l)=>l.bindPopup(
    `<b>#${{f.properties.task_id}}</b><br>${{f.properties.type_bk}} / ${{f.properties.type_hd}}<br>`+
    `${{f.properties.address}}<br>SLA: ${{f.properties.tw}}<br>Приоритет: ${{f.properties.priority}}`)
}}).addTo(map);
</script></body></html>"""