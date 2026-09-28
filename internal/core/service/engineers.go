package service

import (
	"context"
	"os"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
)

func (s *PlanService) GetEngineers(
	ctx context.Context,
	region string,
) ([]dto.EngineerView, error) {

	engineers, err := s.loadEngineers(ctx, region)
	if err != nil {
		return nil, err
	}

	plan, err := s.cacheRepository.GetPlanByRegion(ctx, region)
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	routeByEngineer := make(map[string]dto.Route)
	if plan != nil {
		for _, route := range plan.Routes {
			routeByEngineer[route.EngineerId] = route
		}
	}

	views := make([]dto.EngineerView, 0, len(engineers))
	for _, eng := range engineers {
		views = append(views, buildEngineerView(eng, routeByEngineer[eng.ID]))
	}

	return views, nil
}

func buildEngineerView(
	eng *entities.Engineer, 
	route dto.Route,
) dto.EngineerView {
	
	taskIDs := make([]int, 0, len(route.Tasks))
	for _, task := range route.Tasks {
		taskIDs = append(taskIDs, task.ID)
	}

	loadPercent := 0.0
	if shift := eng.ShiftEnd - eng.ShiftStart; shift > 0 {
		busy := route.TravelTimeMin + route.ServiceTimeMin
		loadPercent = roundTo(float64(busy)/float64(shift)*100, 1)
	}

	return dto.EngineerView{
		Engineer:       *eng,
		TaskCount:      len(route.Tasks),
		TaskIDs:        taskIDs,
		DistanceKm:     route.DistanceKm,
		TravelTimeMin:  route.TravelTimeMin,
		ServiceTimeMin: route.ServiceTimeMin,
		LoadPercent:    loadPercent,
	}
}
