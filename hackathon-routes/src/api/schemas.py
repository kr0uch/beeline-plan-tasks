from __future__ import annotations
from pydantic import BaseModel


class TaskIn(BaseModel):
    id: int
    type_bk: str
    type_hd: str
    district: str
    address: str
    lat: float | None = None
    lon: float | None = None
    tw_start: int
    tw_end: int
    service_time: int | None = None
    priority: str | None = None
    required_skills: list[str] | None = None
    required_equipment: list[str] | None = None


class EngineerIn(BaseModel):
    id: str
    name: str
    skills: list[str]
    equipment: list[str]
    transport: str = "car"
    shift_start: int = 540
    shift_end: int = 1320
    depot_lat: float
    depot_lon: float
    depot_address: str = ""


class PlanRequest(BaseModel):
    region: str
    tasks: list[TaskIn]
    engineers: list[EngineerIn]
    options: dict | None = None


class ReplanRequest(BaseModel):
    region: str
    new_task: TaskIn
    current_state: dict
    pending_tasks: list[TaskIn]
    locked_task_ids: list[int]
    engineers: list[EngineerIn]
    options: dict | None = None


class RouteOut(BaseModel):
    engineer_id: str
    engineer_name: str
    transport: str
    distance_km: float
    time_min: int
    travel_time_min: int
    service_time_min: int
    tasks: list[dict]


class AssignedOut(BaseModel):
    task_id: int
    engineer_id: str
    engineer_name: str
    arrival_min: int
    start_min: int
    end_min: int
    tw_start: int
    tw_end: int
    priority: str
    position_in_route: int
    late_min: int
    explanation: str


class UnassignedOut(BaseModel):
    task_id: int
    reason: str
    explanation: str


class MetricsOut(BaseModel):
    status: str
    total_tasks: int
    assigned: int
    unassigned: int
    assigned_rate: float
    engineers_used: int
    total_distance_km: float
    total_time_min: int
    total_travel_min: int
    late_count: int
    total_late_min: int
    overtime_min: int
    load_mean: float
    load_std: float
    load_max: int
    load_min: int


class PlanResponse(BaseModel):
    routes: list[RouteOut]
    assigned: list[AssignedOut]
    unassigned: list[UnassignedOut]
    ml_metrics: MetricsOut