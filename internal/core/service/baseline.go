package service

import (
	"context"
	"math"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
)

type baselineEngineer struct {
	position   entities.GeoData
	clock      int
	taskCount  int
	distanceKm float64
	travelMin  int
	serviceMin int
}

func (s *PlanService) calculateBaselineMetrics(
	ctx context.Context,
	tasks []*entities.Task,
	engineers []*entities.Engineer,
	startState map[string]dto.EngineerState,
) (*dto.Metrics, error) {

	if len(tasks) == 0 {
		return &dto.Metrics{Status: "OK"}, nil
	}

	cursors := make(map[string]*baselineEngineer, len(engineers))
	for _, eng := range engineers {
		cursor := &baselineEngineer{
			position: entities.GeoData{Lat: eng.DepotLat, Lon: eng.DepotLon},
			clock:    eng.ShiftStart,
		}
		if state, ok := startState[eng.ID]; ok {
			cursor.position = state.GeoData
			cursor.clock = state.TimeMin
		}
		cursors[eng.ID] = cursor
	}

	assigned := 0
	for _, task := range tasks {
		for _, eng := range engineers {
			if !canServe(eng, task) {
				continue
			}

			cursor := cursors[eng.ID]
			leg, err := s.geoRepository.GetDistanceAndTravelTimeHaversine(ctx, &dto.GetDistanceAndTravelTimeRequest{
				CurrentLat: cursor.position.Lat,
				CurrentLon: cursor.position.Lon,
				TargetLat:  task.Lat,
				TargetLon:  task.Lon,
			})
			if err != nil {
				return nil, err
			}

			start := max(cursor.clock+leg.Time, task.TWStart)
			end := start + task.ServiceTime
			if start > task.TWEnd || end > eng.ShiftEnd {
				continue
			}

			cursor.position = entities.GeoData{Lat: task.Lat, Lon: task.Lon}
			cursor.clock = end
			cursor.taskCount++
			cursor.distanceKm += leg.Distance
			cursor.travelMin += leg.Time
			cursor.serviceMin += task.ServiceTime
			assigned++
			break
		}
	}

	return buildBaselineMetrics(len(tasks), assigned, engineers, cursors), nil
}

func buildBaselineMetrics(
	totalTasks int,
	assigned int,
	engineers []*entities.Engineer,
	cursors map[string]*baselineEngineer,
) *dto.Metrics {

	loads := make([]int, 0, len(engineers))
	engineersUsed := 0
	totalDistanceKm := 0.0
	totalTravelMin, totalServiceMin := 0, 0
	for _, eng := range engineers {
		cursor := cursors[eng.ID]
		loads = append(loads, cursor.taskCount)
		totalDistanceKm += cursor.distanceKm
		totalTravelMin += cursor.travelMin
		totalServiceMin += cursor.serviceMin
		if cursor.taskCount > 0 {
			engineersUsed++
		}
	}

	loadMean, loadStd, loadMin, loadMax := loadStats(loads)

	return &dto.Metrics{
		Status:          "OK",
		TotalTasks:      totalTasks,
		Assigned:        assigned,
		Unassigned:      totalTasks - assigned,
		AssignedRate:    roundTo(float64(assigned)/float64(totalTasks), 4),
		LoadMean:        roundTo(loadMean, 2),
		LoadStd:         roundTo(loadStd, 2),
		LoadMax:         loadMax,
		LoadMin:         loadMin,
		EngineersUsed:   engineersUsed,
		TotalDistanceKm: roundTo(totalDistanceKm, 2),
		TotalTimeMin:    totalTravelMin + totalServiceMin,
		TotalTravelMin:  totalTravelMin,
	}
}

func loadStats(loads []int) (mean, std float64, minLoad, maxLoad int) {
	if len(loads) == 0 {
		return 0, 0, 0, 0
	}

	minLoad, maxLoad = loads[0], loads[0]
	sum := 0
	for _, load := range loads {
		minLoad = min(minLoad, load)
		maxLoad = max(maxLoad, load)
		sum += load
	}
	mean = float64(sum) / float64(len(loads))

	variance := 0.0
	for _, load := range loads {
		diff := float64(load) - mean
		variance += diff * diff
	}
	std = math.Sqrt(variance / float64(len(loads)))

	return mean, std, minLoad, maxLoad
}

func canServe(
	eng *entities.Engineer, 
	task *entities.Task,
) bool {
	
	return containsAll(eng.Skills, task.RequiredSkills) &&
		containsAll(eng.Equipment, task.RequiredEquipment)
}

func containsAll[T comparable](have, need []T) bool {
	set := make(map[T]bool, len(have))
	for _, item := range have {
		set[item] = true
	}
	for _, item := range need {
		if !set[item] {
			return false
		}
	}
	return true
}

func roundTo(value float64, digits int) float64 {
	pow := math.Pow(10, float64(digits))
	return math.Round(value*pow) / pow
}
