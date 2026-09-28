package service

import (
	"context"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/entities"
)

const reasonAddressNotFound = "address_not_found"

func (s *PlanService) fillTasksGeoData(
	ctx context.Context,
	region string,
	tasks []*entities.Task,
) error {

	addresses := make([]string, 0, len(tasks))
	for _, task := range tasks {
		if !hasTaskCoords(task) {
			addresses = append(addresses, task.Address)
		}
	}
	if len(addresses) == 0 {
		return nil
	}

	geoByAddress, err := s.resolveAddresses(ctx, region, addresses)
	if err != nil {
		return err
	}

	for _, task := range tasks {
		if hasTaskCoords(task) {
			continue
		}
		if geo, ok := geoByAddress[task.Address]; ok {
			task.Lat = geo.Lat
			task.Lon = geo.Lon
		}
	}

	return nil
}

func (s *PlanService) fillEngineersGeoData(
	ctx context.Context,
	region string,
	engineers []*entities.Engineer,
) error {

	withoutCoords := make([]*entities.Engineer, 0)
	for _, eng := range engineers {
		if !hasDepotCoords(eng) && eng.DepotAddress != "" {
			withoutCoords = append(withoutCoords, eng)
		}
	}
	if len(withoutCoords) == 0 {
		return nil
	}

	depots, err := s.cacheRepository.LoadDepots(ctx, region)
	if err != nil {
		return err
	}

	addresses := make([]string, 0, len(withoutCoords))
	for _, eng := range withoutCoords {
		if !hasCoords(depots[eng.DepotAddress]) {
			addresses = append(addresses, eng.DepotAddress)
		}
	}

	geoByAddress, err := s.resolveAddresses(ctx, region, addresses)
	if err != nil {
		return err
	}

	updated := false
	for _, eng := range withoutCoords {
		geo, ok := depots[eng.DepotAddress]
		if !hasCoords(geo) {
			geo, ok = geoByAddress[eng.DepotAddress]
		}
		if !ok || !hasCoords(geo) {
			continue
		}

		eng.DepotLat = geo.Lat
		eng.DepotLon = geo.Lon
		updated = true
	}

	if !updated {
		return nil
	}

	return s.engineerRepository.SaveEngineersToCSVByRegion(ctx, region, engineers)
}

func (s *PlanService) resolveAddresses(
	ctx context.Context,
	region string,
	addresses []string,
) (map[string]entities.GeoData, error) {

	geoCache, err := s.cacheRepository.LoadGeoCache(ctx, region)
	if err != nil {
		return nil, err
	}

	missing := make([]string, 0)
	seen := make(map[string]bool)
	for _, addr := range addresses {
		if addr == "" || seen[addr] || hasCoords(geoCache[addr]) {
			continue
		}
		seen[addr] = true
		missing = append(missing, addr)
	}
	if len(missing) == 0 {
		return geoCache, nil
	}

	batch, err := s.geoRepository.BatchGetGeoDataByAddresses(ctx, missing)
	if err != nil {
		return nil, err
	}

	updated := false
	for addr, geo := range batch {
		if hasCoords(geo) {
			geoCache[addr] = geo
			updated = true
		}
	}

	if updated {
		if err = s.cacheRepository.SaveGeoCache(ctx, region, geoCache); err != nil {
			return nil, err
		}
	}

	return geoCache, nil
}

func splitByGeoData(
	tasks []*entities.Task,
) (located, notLocated []*entities.Task) {

	located = make([]*entities.Task, 0, len(tasks))
	for _, task := range tasks {
		if hasTaskCoords(task) {
			located = append(located, task)
		} else {
			notLocated = append(notLocated, task)
		}
	}
	return located, notLocated
}

func unassignedAddressNotFound(
	tasks []*entities.Task,
) []dto.UnassignedTask {

	result := make([]dto.UnassignedTask, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, dto.UnassignedTask{
			TaskID: task.ID,
			Reason: reasonAddressNotFound,
		})
	}
	return result
}

func hasCoords(geo entities.GeoData) bool {
	return geo.Lat != 0 || geo.Lon != 0
}

func hasTaskCoords(task *entities.Task) bool {
	return task.Lat != 0 || task.Lon != 0
}

func hasDepotCoords(eng *entities.Engineer) bool {
	return eng.DepotLat != 0 || eng.DepotLon != 0
}
