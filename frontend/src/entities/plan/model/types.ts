
export type Task = {
  id: number
  address: string
  district: string
  lat: number
  lon: number
  priority: string
  required_equipment: string[]
  required_skills: string[]
  service_time: number
  tw_start: number
  tw_end: number
  type_bk: string
  type_hd: string
}

export type AssignedTask = {
  task_id: number
  engineer_id: string
  engineer_name: string
  position_in_route: number
  priority: string
  arrival_min: number
  start_min: number
  end_min: number
  late_min: number
  tw_start: number
  tw_end: number
  explanation: string
}

export type UnassignedTask = {
  task_id: number
  reason: string
  explanation: string
}

export type Route = {
  engineer_id: string
  engineer_name: string
  transport: string
  distance_km: number
  time_min: number
  tasks: Task[]
}

export type Metrics = {
  status: string
  total_tasks: number
  assigned: number
  unassigned: number
  assigned_rate: number
  engineers_used: number
  late_count: number
  total_late_min: number
  overtime_min: number
  total_distance_km: number
  load_min: number
  load_max: number
  load_mean: number
  load_std: number
}

export type PlanResponse = {
  assigned: AssignedTask[]
  unassigned: UnassignedTask[]
  routes: Route[]
  ml_metrics: Metrics
  baseline_metrics: Metrics
}
