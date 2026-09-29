package dto

import (
	"io"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
)

type MLOptions struct {
	TimeLimitSec int `json:"time_limit_sec,omitempty"`
}

type MLPlanRequest struct {
	Region    string               `json:"region"`
	Tasks     []*entities.Task     `json:"tasks"`
	Engineers []*entities.Engineer `json:"engineers"`
	Options   *MLOptions           `json:"options,omitempty"`
}

type Route struct {
	EngineerId     string           `json:"engineer_id"`
	EngineerName   string           `json:"engineer_name"`
	Transport      string           `json:"transport"`
	DistanceKm     float64          `json:"distance_km"`
	TimeMin        int              `json:"time_min"`
	TravelTimeMin  int              `json:"travel_time_min"`
	ServiceTimeMin int              `json:"service_time_min"`
	Tasks          []*entities.Task `json:"tasks"`
}

type AssignedTask struct {
	TaskID          int            `json:"task_id"`
	EngineerID      string         `json:"engineer_id"`
	EngineerName    string         `json:"engineer_name"`
	ArrivalMin      int            `json:"arrival_min"`
	StartMin        int            `json:"start_min"`
	EndMin          int            `json:"end_min"`
	Priority        string         `json:"priority"`
	PositionInRoute int            `json:"position_in_route"`
	LateMin         int            `json:"late_min"`
	Explanation     string         `json:"explanation"`
	Task            *entities.Task `json:"task,omitempty"`
}

func (a AssignedTask) Window() (start, end int, ok bool) {
	if a.Task == nil {
		return 0, 0, false
	}
	return a.Task.TWStart, a.Task.TWEnd, true
}

type UnassignedTask struct {
	TaskID      int            `json:"task_id"`
	Reason      string         `json:"reason"`
	Explanation string         `json:"explanation"`
	Task        *entities.Task `json:"task,omitempty"`
}

const (
	ChangeAdded           = "added"
	ChangeAddedUnassigned = "added_unassigned"
	ChangeAssigned        = "assigned"
	ChangeReassigned      = "reassigned"
	ChangeRescheduled     = "rescheduled"
	ChangeUnassigned      = "unassigned"
)

type PlanChange struct {
	TaskID         int    `json:"task_id"`
	Type           string `json:"type"`
	FromEngineerID string `json:"from_engineer_id,omitempty"`
	ToEngineerID   string `json:"to_engineer_id,omitempty"`
	OldStartMin    int    `json:"old_start_min,omitempty"`
	NewStartMin    int    `json:"new_start_min,omitempty"`
	DeltaMin       int    `json:"delta_min,omitempty"`
}

type Metrics struct {
	Status          string  `json:"status"`
	TotalTasks      int     `json:"total_tasks"`
	Assigned        int     `json:"assigned"`
	Unassigned      int     `json:"unassigned"`
	AssignedRate    float64 `json:"assigned_rate"`
	LateCount       int     `json:"late_count"`
	TotalLateMin    int     `json:"total_late_min"`
	OvertimeMin     int     `json:"overtime_min"`
	LoadMean        float64 `json:"load_mean"`
	LoadStd         float64 `json:"load_std"`
	LoadMax         int     `json:"load_max"`
	LoadMin         int     `json:"load_min"`
	EngineersUsed   int     `json:"engineers_used"`
	TotalDistanceKm float64 `json:"total_distance_km"`
	TotalTimeMin    int     `json:"total_time_min"`
	TotalTravelMin  int     `json:"total_travel_min"`
}

type PlanResponse struct {
	Routes          []Route          `json:"routes"`
	Assigned        []AssignedTask   `json:"assigned"`
	Unassigned      []UnassignedTask `json:"unassigned"`
	MLMetrics       Metrics          `json:"ml_metrics"`
	BaselineMetrics *Metrics         `json:"baseline_metrics"`
	Changes         []PlanChange     `json:"changes,omitempty"`
}

type EngineerView struct {
	entities.Engineer
	TaskCount      int     `json:"task_count"`
	TaskIDs        []int   `json:"task_ids"`
	DistanceKm     float64 `json:"distance_km"`
	TravelTimeMin  int     `json:"travel_time_min"`
	ServiceTimeMin int     `json:"service_time_min"`
	LoadPercent    float64 `json:"load_percent"`
}

type HealthResponse struct {
	Status string `json:"status"`
	ML     string `json:"ml"`
}

type PlanRequest struct {
	Region         string
	TasksReader    io.Reader
	ExplainWithLLM bool
}

type ReplanRequest struct {
	Region         string         `json:"-"`
	ExplainWithLLM bool           `json:"-"`
	NewTask        *entities.Task `json:"new_task"`
	CurrentTimeMin int            `json:"current_time_min"`
}

type MLReplanRequest struct {
	Region        string                   `json:"region"`
	NewTask       *entities.Task           `json:"new_task"`
	CurrentState  map[string]EngineerState `json:"current_state"`
	PendingTasks  []*entities.Task         `json:"pending_tasks"`
	LockedTaskIds []int                    `json:"locked_task_ids"`
	Engineers     []*entities.Engineer     `json:"engineers"`
	Options       *MLOptions               `json:"options,omitempty"`
}

type EngineerState struct {
	entities.GeoData
	TimeMin int `json:"time_min"`
}
