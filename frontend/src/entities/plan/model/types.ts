import type { Equipment, Skill } from '@/entities/task'


export type Task = {
  id: number
  address: string
  district: string
  lat: number
  lon: number
  priority: string
  required_equipment: Equipment[]
  required_skills: Skill[]
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
  task?: Task
}

export type Route = {
  engineer_id: string
  engineer_name: string
  transport: string
  distance_km: number
  time_min: number
  service_time_min?: number
  travel_time_min?: number
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
  total_time_min?: number
  total_travel_min?: number
}

export type PlanResponse = {
  assigned: AssignedTask[]
  unassigned: UnassignedTask[]
  routes: Route[]
  ml_metrics: Metrics
  baseline_metrics: Metrics
  changes?: PlanChange[]
}

export type PlanChangeType = 'added' | 'added_unassigned' | 'assigned' | 'reassigned' | 'rescheduled' | 'unassigned'

export type PlanChange = {
  task_id: number
  type: PlanChangeType
  from_engineer_id?: string
  to_engineer_id?: string
  old_start_min?: number
  new_start_min?: number
  delta_min?: number
}

export type RawAssignedTask = Omit<AssignedTask, 'tw_start' | 'tw_end'> & {
  tw_start?: number
  tw_end?: number
  task?: Task
}

export type RawPlanResponse = Omit<PlanResponse, 'assigned' | 'baseline_metrics'> & {
  assigned: RawAssignedTask[] | null
  unassigned: UnassignedTask[] | null
  routes: Route[] | null
  baseline_metrics: Metrics | null
}

export type Engineer = {
  id: string
  name: string
  skills: Skill[] | null
  equipment: Equipment[] | null
  transport: string
  shift_start: number
  shift_end: number
  depot_address: string
  depot_lat?: number
  depot_lon?: number
  task_count: number
  task_ids: number[] | null
  distance_km: number
  travel_time_min: number
  service_time_min: number
  load_percent: number
}

export type Health = {
  status: string
  ml: string
}

export type ReplanRequest = {
  current_time_min: number
  new_task: Task
}
