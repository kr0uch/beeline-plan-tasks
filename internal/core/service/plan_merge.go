package service

import (
	"slices"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
)

func fillRouteTaskIDs(
	plan *dto.PlanResponse,
) {

	type routeSlot struct {
		engineerID string
		position   int
	}

	idBySlot := make(map[routeSlot]int, len(plan.Assigned))
	for _, a := range plan.Assigned {
		idBySlot[routeSlot{a.EngineerID, a.PositionInRoute}] = a.TaskID
	}

	for _, route := range plan.Routes {
		for pos, task := range route.Tasks {
			if task.ID != 0 {
				continue
			}
			if id, ok := idBySlot[routeSlot{route.EngineerId, pos}]; ok {
				task.ID = id
			}
		}
	}
}

func attachTasks(
	plan *dto.PlanResponse, 
	tasks []*entities.Task,
) {
	
	taskByID := make(map[int]*entities.Task, len(tasks))
	for _, task := range tasks {
		if task != nil {
			taskByID[task.ID] = task
		}
	}

	for i := range plan.Assigned {
		if task, ok := taskByID[plan.Assigned[i].TaskID]; ok {
			plan.Assigned[i].Task = task
		}
	}
	for i := range plan.Unassigned {
		if task, ok := taskByID[plan.Unassigned[i].TaskID]; ok {
			plan.Unassigned[i].Task = task
		}
	}
}

func mergeReplan(
	fresh *dto.PlanResponse,
	state *dayState,
	engineers []*entities.Engineer,
) *dto.PlanResponse {

	keptIDs := make(map[int]bool)
	for _, stops := range state.kept {
		for _, stop := range stops {
			keptIDs[stop.task.ID] = true
		}
	}

	merged := *fresh
	merged.Routes = make([]dto.Route, len(fresh.Routes))
	routeIdx := make(map[string]int, len(fresh.Routes))
	for i, route := range fresh.Routes {
		route.Tasks = slices.DeleteFunc(slices.Clone(route.Tasks), func(t *entities.Task) bool {
			return t == nil || keptIDs[t.ID]
		})
		merged.Routes[i] = route
		routeIdx[route.EngineerId] = i
	}

	assigned := make([]dto.AssignedTask, 0, len(fresh.Assigned))

	for _, eng := range engineers {
		stops := state.kept[eng.ID]
		if len(stops) == 0 {
			continue
		}

		keptTasks := make([]*entities.Task, 0, len(stops))
		for _, stop := range stops {
			keptTasks = append(keptTasks, stop.task)
			assigned = append(assigned, stop.assigned)
		}

		if i, ok := routeIdx[eng.ID]; ok {
			merged.Routes[i].Tasks = append(keptTasks, merged.Routes[i].Tasks...)
		} else {
			merged.Routes = append(merged.Routes, dto.Route{
				EngineerId:   eng.ID,
				EngineerName: eng.Name,
				Transport:    eng.Transport,
				Tasks:        keptTasks,
			})
		}
	}

	for _, a := range fresh.Assigned {
		if !keptIDs[a.TaskID] {
			assigned = append(assigned, a)
		}
	}

	posByTaskID := make(map[int]int)
	for _, route := range merged.Routes {
		for pos, task := range route.Tasks {
			posByTaskID[task.ID] = pos
		}
	}
	for i := range assigned {
		if pos, ok := posByTaskID[assigned[i].TaskID]; ok {
			assigned[i].PositionInRoute = pos
		}
	}
	merged.Assigned = assigned

	return &merged
}

func diffPlans(
	prev,
	next *dto.PlanResponse,
	newTaskID int,
) []dto.PlanChange {

	prevByID := make(map[int]dto.AssignedTask, len(prev.Assigned))
	for _, a := range prev.Assigned {
		prevByID[a.TaskID] = a
	}

	nextAssigned := make(map[int]bool, len(next.Assigned))
	changes := make([]dto.PlanChange, 0)

	for _, a := range next.Assigned {
		nextAssigned[a.TaskID] = true
		p, was := prevByID[a.TaskID]

		change := dto.PlanChange{
			TaskID:       a.TaskID,
			ToEngineerID: a.EngineerID,
			NewStartMin:  a.StartMin,
		}

		switch {
		case !was && a.TaskID == newTaskID:
			change.Type = dto.ChangeAdded
		case !was:
			change.Type = dto.ChangeAssigned
		case p.EngineerID != a.EngineerID:
			change.Type = dto.ChangeReassigned
		case p.StartMin != a.StartMin:
			change.Type = dto.ChangeRescheduled
		default:
			continue
		}

		if was {
			change.FromEngineerID = p.EngineerID
			change.OldStartMin = p.StartMin
			change.DeltaMin = a.StartMin - p.StartMin
		}
		changes = append(changes, change)
	}

	for _, u := range next.Unassigned {
		p, was := prevByID[u.TaskID]
		switch {
		case u.TaskID == newTaskID:
			changes = append(changes, dto.PlanChange{
				TaskID: u.TaskID,
				 Type: dto.ChangeAddedUnassigned,
				})
		case was && !nextAssigned[u.TaskID]:
			changes = append(changes, dto.PlanChange{
				TaskID:         u.TaskID,
				Type:           dto.ChangeUnassigned,
				FromEngineerID: p.EngineerID,
				OldStartMin:    p.StartMin,
			})
		}
	}

	return changes
}
