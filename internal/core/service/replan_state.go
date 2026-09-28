package service

import (
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

type keptStop struct {
	task     *entities.Task
	assigned dto.AssignedTask
}

type dayState struct {
	engineers     map[string]dto.EngineerState
	lockedTaskIDs []int
	pendingTasks  []*entities.Task
	kept          map[string][]keptStop
}

func buildDayState(
	currentTimeMin int,
	plan *dto.PlanResponse,
	engineers []*entities.Engineer,
	allTasks []*entities.Task,
	newTask *entities.Task,
) (*dayState, error) {

	engineerByID := make(map[string]*entities.Engineer, len(engineers))
	for _, eng := range engineers {
		engineerByID[eng.ID] = eng
	}

	taskByID := make(map[int]*entities.Task, len(allTasks))
	for _, task := range allTasks {
		taskByID[task.ID] = task
	}

	assignedByID := make(map[int]dto.AssignedTask, len(plan.Assigned))
	for _, a := range plan.Assigned {
		assignedByID[a.TaskID] = a
	}

	state := &dayState{
		engineers:     make(map[string]dto.EngineerState, len(engineers)),
		lockedTaskIDs: make([]int, 0),
		pendingTasks:  make([]*entities.Task, 0),
		kept:          make(map[string][]keptStop),
	}

	for _, eng := range engineers {
		state.engineers[eng.ID] = dto.EngineerState{
			GeoData: entities.GeoData{Lat: eng.DepotLat, Lon: eng.DepotLon},
			TimeMin: max(eng.ShiftStart, currentTimeMin),
		}
	}

	done := make(map[int]bool)
	planned := make(map[int]bool)

	for _, route := range plan.Routes {
		if len(route.Tasks) == 0 {
			continue
		}

		eng, ok := engineerByID[route.EngineerId]
		if !ok {
			return nil, errors.ErrPlanOutdated
		}

		stopped := false
		for _, routeTask := range route.Tasks {
			task, ok := taskByID[routeTask.ID]
			if !ok {
				task = routeTask
			}
			planned[task.ID] = true

			if stopped {
				continue
			}

			a, ok := assignedByID[task.ID]
			if !ok {
				stopped = true
				continue
			}

			done[task.ID] = true
			state.kept[eng.ID] = append(state.kept[eng.ID], keptStop{task: task, assigned: a})
			state.engineers[eng.ID] = dto.EngineerState{
				GeoData: entities.GeoData{
					Lat: task.Lat,
					Lon: task.Lon,
				},
				TimeMin: max(a.EndMin, currentTimeMin, eng.ShiftStart),
			}

			if a.EndMin > currentTimeMin {
				state.lockedTaskIDs = append(state.lockedTaskIDs, task.ID)
				stopped = true
			}
		}
	}

	seen := make(map[int]bool, len(allTasks))
	for _, task := range allTasks {
		if seen[task.ID] || done[task.ID] {
			continue
		}
		if newTask != nil && task.ID == newTask.ID {
			continue
		}
		seen[task.ID] = true

		if planned[task.ID] || task.TWEnd >= currentTimeMin {
			state.pendingTasks = append(state.pendingTasks, task)
		}
	}

	return state, nil
}
